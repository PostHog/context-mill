defmodule PostHogExample.Application do
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    warn_if_token_missing()
    :ets.new(:demo_users, [:named_table, :public, :set])

    children = [
      PostHogExampleWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: PostHogExample.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    PostHogExampleWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # Fail loudly, but don't break the app: with a blank token the SDK simply
  # won't deliver events. We log a clear warning and let the app boot.
  defp warn_if_token_missing do
    case Application.get_env(:posthog, :api_key) do
      token when token in [nil, ""] ->
        Logger.warning(
          "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " <>
            "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
        )

      _token ->
        :ok
    end
  end
end
