defmodule PostHogExampleWeb.BurritoController do
  @moduledoc """
  The whole burrito app, and every PostHog integration point:

    * user identification  -> /login
    * event tracking       -> /burrito
    * feature flags        -> /dashboard
    * error tracking       -> /profile (see the note in `trigger_error/2`)

  All PostHog calls use the documented v2.0 SDK API:
  https://posthog.com/docs/libraries/elixir
  """

  use PostHogExampleWeb, :controller
  require Logger

  plug :assign_identity

  # ---------------------------------------------------------------------------
  # Home / login
  # ---------------------------------------------------------------------------

  def home(conn, _params) do
    render(conn, :home, distinct_id: conn.assigns.distinct_id)
  end

  @doc """
  Identify the user.

  The PostHog Elixir SDK has no separate `identify` step for server events —
  you identify a user by passing their `distinct_id` on `capture`. The
  `distinct_id` must match the id your frontend `posthog.identify(...)` uses,
  so events from both sides attach to the same person.

  We derive a stable distinct id from the username and remember it in the
  session so every later request captures against the same person.

  Identity note: this demo takes the username from an unverified form field for
  simplicity. A real app must derive `distinct_id` from the authenticated
  principal (session / token), never from an unverified request param — otherwise
  a client could pick any id and overwrite another person's profile.
  """
  def login(conn, params) do
    username = params["username"] || "burrito_fan"
    distinct_id = "user_" <> username

    # PostHog: identify + capture in one call. Extra keys in the map become
    # event properties.
    PostHog.capture("user_logged_in", %{
      distinct_id: distinct_id,
      login_method: "email"
    })

    conn
    |> put_session(:distinct_id, distinct_id)
    |> redirect(to: ~p"/dashboard")
  end

  def logout(conn, _params) do
    # Capture before we drop the session so the event is still attributed.
    capture(conn, "user_logged_out")

    conn
    |> delete_session(:distinct_id)
    |> redirect(to: ~p"/")
  end

  # ---------------------------------------------------------------------------
  # Event tracking
  # ---------------------------------------------------------------------------

  def burrito(conn, _params) do
    render(conn, :burrito, count: get_session(conn, :burrito_count) || 0)
  end

  @doc "Track a custom `burrito_considered` event with properties."
  def consider_burrito(conn, _params) do
    count = (get_session(conn, :burrito_count) || 0) + 1

    # PostHog: custom event. `distinct_id` is required; the rest are properties.
    capture(conn, "burrito_considered", %{total_considerations: count})

    conn
    |> put_session(:burrito_count, count)
    |> redirect(to: ~p"/burrito")
  end

  # ---------------------------------------------------------------------------
  # Feature flags
  # ---------------------------------------------------------------------------

  @doc """
  Evaluate flags once per request, then read individual flags off the snapshot.
  """
  def dashboard(conn, _params) do
    distinct_id = conn.assigns.distinct_id

    show_new_feature =
      case PostHog.FeatureFlags.evaluate_flags(distinct_id) do
        {:ok, snapshot} ->
          PostHog.FeatureFlags.Evaluations.enabled?(snapshot, "new-dashboard-feature")

        _error ->
          # Fail safe: if flag evaluation fails, fall back to "off".
          false
      end

    capture(conn, "dashboard_viewed")

    render(conn, :dashboard, show_new_feature: show_new_feature)
  end

  # ---------------------------------------------------------------------------
  # Error tracking
  # ---------------------------------------------------------------------------

  def profile(conn, _params) do
    capture(conn, "profile_viewed")
    message = get_session(conn, :message)

    conn
    |> delete_session(:message)
    |> render(:profile, distinct_id: conn.assigns.distinct_id, message: message)
  end

  @doc """
  Demonstrate error tracking.

  PostHog's Elixir SDK does error tracking *automatically*: it is built on top
  of Elixir's `Logger`, so any `Logger.error/1` call and any uncaught exception
  is captured — there is no documented explicit `capture_exception` function.

  So here we `rescue` a deliberate exception and report it two ways:

    1. `Logger.error(...)` — which the SDK auto-captures as an exception, and
    2. an explicit `error_occurred` custom event for easy funnel/analytics use.
  """
  def trigger_error(conn, _params) do
    try do
      raise "Something went wrong while loading the burrito profile!"
    rescue
      error ->
        # PostHog auto-captures this Logger.error as an exception.
        Logger.error("Burrito profile error: #{Exception.message(error)}")

        # Plus an explicit analytics event, matching the other examples.
        capture(conn, "error_occurred", %{
          error_type: error.__struct__ |> Module.split() |> List.last(),
          error_message: Exception.message(error)
        })
    end

    conn
    |> put_flash_message("Error triggered and captured by PostHog.")
    |> redirect(to: ~p"/profile")
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  # Signed-in users keep their stable id. A signed-out visitor gets a random
  # UUID that lives in the session for the whole visit, and their events are
  # captured without a person profile. Never share one id such as "anonymous"
  # across visitors: PostHog would merge them into a single person.
  defp assign_identity(conn, _opts) do
    {conn, distinct_id, anonymous?} =
      case get_session(conn, :distinct_id) do
        nil ->
          conn = ensure_visitor_id(conn)
          {conn, get_session(conn, :visitor_id), true}

        distinct_id ->
          {conn, distinct_id, false}
      end

    # Context is attached to everything captured later in this request,
    # including errors the SDK captures from Logger.
    PostHog.set_context(
      if anonymous?,
        do: %{distinct_id: distinct_id, "$process_person_profile": false},
        else: %{distinct_id: distinct_id}
    )

    conn |> assign(:distinct_id, distinct_id) |> assign(:anonymous?, anonymous?)
  end

  defp ensure_visitor_id(conn) do
    if get_session(conn, :visitor_id), do: conn, else: put_session(conn, :visitor_id, uuid4())
  end

  # Capture against the request's identity; anonymous visitors are personless.
  defp capture(conn, event, properties \\ %{}) do
    properties = Map.put(properties, :distinct_id, conn.assigns.distinct_id)

    properties =
      if conn.assigns.anonymous?,
        do: Map.put(properties, :"$process_person_profile", false),
        else: properties

    PostHog.capture(event, properties)
  end

  defp uuid4 do
    <<a::48, _::4, b::12, _::2, c::62>> = :crypto.strong_rand_bytes(16)
    hex = Base.encode16(<<a::48, 4::4, b::12, 2::2, c::62>>, case: :lower)

    <<p1::binary-8, p2::binary-4, p3::binary-4, p4::binary-4, p5::binary-12>> = hex
    Enum.join([p1, p2, p3, p4, p5], "-")
  end

  # Tiny session-backed flash (this app doesn't wire the full Phoenix flash).
  defp put_flash_message(conn, message), do: put_session(conn, :message, message)
end
