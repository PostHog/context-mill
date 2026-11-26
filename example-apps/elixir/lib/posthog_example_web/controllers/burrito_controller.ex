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
    message = get_session(conn, :message)

    conn
    |> delete_session(:message)
    |> render(:home,
      distinct_id: conn.assigns.distinct_id,
      anonymous?: conn.assigns.anonymous?,
      message: message
    )
  end

  @doc """
  Identify the user.

  The PostHog Elixir SDK has no separate `identify` step for server events.
  You identify a user by passing their `distinct_id` on `capture`. The
  `distinct_id` must match the id your frontend `posthog.identify(...)` uses,
  so events from both sides attach to the same person.

  We assign each username a stable UUID (standing in for a database primary key)
  and remember it in the session so every later request captures against the same
  person. Never use the username or email itself as `distinct_id`. Send those as
  person properties via `$set` instead.
  """
  def login(conn, params) do
    # Reject missing or blank usernames instead of falling back to a shared default username,
    # which would merge every empty login submission into one person profile.
    username =
      case params["username"] do
        value when is_binary(value) -> String.trim(value)
        _ -> ""
      end

    if username == "" do
      conn
      |> put_flash_message("Please enter a username to log in.")
      |> redirect(to: ~p"/")
    else
      distinct_id = get_or_create_user_id(username)

      # Identify and capture in one call. "$set" writes person properties while keeping
      # username PII out of top-level event properties.
      PostHog.capture("user_logged_in", %{
        distinct_id: distinct_id,
        login_method: "username",
        "$set": %{username: username}
      })

      conn
      |> put_session(:distinct_id, distinct_id)
      |> redirect(to: ~p"/dashboard")
    end
  end

  def logout(conn, _params) do
    # Only capture user_logged_out when signing out of an authenticated session,
    # never for an anonymous visitor.
    if not conn.assigns.anonymous? do
      capture(conn, "user_logged_out")
    end

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

    # Pass distinct_id via the helper and attach non-PII event properties.
    capture(conn, "burrito_considered", %{total_considerations: count})

    conn
    |> put_session(:burrito_count, count)
    |> redirect(to: ~p"/burrito")
  end

  # ---------------------------------------------------------------------------
  # Feature flags
  # ---------------------------------------------------------------------------

  @doc """
  Evaluate flags once per request, read individual flags off the snapshot,
  and attach accessed flags to the process context before capturing events.
  """
  def dashboard(conn, _params) do
    distinct_id = conn.assigns.distinct_id

    show_new_feature =
      case PostHog.FeatureFlags.evaluate_flags(distinct_id) do
        {:ok, snapshot} ->
          enabled =
            PostHog.FeatureFlags.Evaluations.enabled?(snapshot, "new-dashboard-feature")

          PostHog.FeatureFlags.set_in_context(
            PostHog.FeatureFlags.Evaluations.only_accessed(snapshot)
          )

          enabled

        _error ->
          # Fail safe: if flag evaluation fails, fall back to off.
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

  PostHog's Elixir SDK performs error tracking automatically through Elixir's
  `Logger`, so any `Logger.error/1` call and any uncaught exception is captured.

  Here we `rescue` a deliberate exception and report it two ways:

    1. `Logger.error(...)`, which the SDK auto-captures as an exception, and
    2. an explicit `error_occurred` custom event for funnel and analytics use.
  """
  def trigger_error(conn, _params) do
    try do
      raise "Something went wrong while loading the burrito profile!"
    rescue
      error ->
        Logger.error("Burrito profile error: #{Exception.message(error)}")

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
  # across visitors because PostHog would merge them into a single person.
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

  # Capture against the request identity, keeping anonymous visitors personless.
  defp capture(conn, event, properties \\ %{}) do
    properties = Map.put(properties, :distinct_id, conn.assigns.distinct_id)

    properties =
      if conn.assigns.anonymous?,
        do: Map.put(properties, :"$process_person_profile", false),
        else: properties

    PostHog.capture(event, properties)
  end

  defp get_or_create_user_id(username) do
    case :ets.lookup(:demo_users, username) do
      [{^username, id}] ->
        id

      [] ->
        id = uuid4()
        if :ets.insert_new(:demo_users, {username, id}), do: id, else: get_or_create_user_id(username)
    end
  end

  defp uuid4 do
    <<a::48, _::4, b::12, _::2, c::62>> = :crypto.strong_rand_bytes(16)
    hex = Base.encode16(<<a::48, 4::4, b::12, 2::2, c::62>>, case: :lower)

    <<p1::binary-8, p2::binary-4, p3::binary-4, p4::binary-4, p5::binary-12>> = hex
    Enum.join([p1, p2, p3, p4, p5], "-")
  end

  # Tiny session-backed flash (this app does not wire the full Phoenix flash).
  defp put_flash_message(conn, message), do: put_session(conn, :message, message)
end
