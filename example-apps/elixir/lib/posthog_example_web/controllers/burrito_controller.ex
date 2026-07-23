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

  # ---------------------------------------------------------------------------
  # Home / login
  # ---------------------------------------------------------------------------

  def home(conn, _params) do
    render(conn, :home, distinct_id: current_distinct_id(conn))
  end

  @doc """
  Identify the user.

  The PostHog Elixir SDK has no separate `identify` step for server events —
  you identify a user by passing their `distinct_id` on `capture`. The
  `distinct_id` must match the id your frontend `posthog.identify(...)` uses,
  so events from both sides attach to the same person.

  We derive a stable distinct id from the username and remember it in the
  session so every later request captures against the same person.
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
    PostHog.capture("user_logged_out", %{distinct_id: current_distinct_id(conn)})

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
    PostHog.capture("burrito_considered", %{
      distinct_id: current_distinct_id(conn),
      total_considerations: count
    })

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
    distinct_id = current_distinct_id(conn)

    show_new_feature =
      case PostHog.FeatureFlags.evaluate_flags(distinct_id) do
        {:ok, snapshot} ->
          PostHog.FeatureFlags.Evaluations.enabled?(snapshot, "new-dashboard-feature")

        _error ->
          # Fail safe: if flag evaluation fails, fall back to "off".
          false
      end

    PostHog.capture("dashboard_viewed", %{distinct_id: distinct_id})

    render(conn, :dashboard, show_new_feature: show_new_feature)
  end

  # ---------------------------------------------------------------------------
  # Error tracking
  # ---------------------------------------------------------------------------

  def profile(conn, _params) do
    PostHog.capture("profile_viewed", %{distinct_id: current_distinct_id(conn)})
    message = get_session(conn, :message)

    conn
    |> delete_session(:message)
    |> render(:profile, distinct_id: current_distinct_id(conn), message: message)
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
    distinct_id = current_distinct_id(conn)

    try do
      raise "Something went wrong while loading the burrito profile!"
    rescue
      error ->
        # PostHog auto-captures this Logger.error as an exception.
        Logger.error("Burrito profile error: #{Exception.message(error)}")

        # Plus an explicit analytics event, matching the other examples.
        PostHog.capture("error_occurred", %{
          distinct_id: distinct_id,
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

  # A stable distinct id for the session, or "anonymous" before login.
  defp current_distinct_id(conn), do: get_session(conn, :distinct_id) || "anonymous"

  # Tiny session-backed flash (this app doesn't wire the full Phoenix flash).
  defp put_flash_message(conn, message), do: put_session(conn, :message, message)
end
