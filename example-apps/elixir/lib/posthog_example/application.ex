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

  # Warn outside production when POSTHOG_PROJECT_TOKEN is missing or blank while keeping boot non-fatal.
  defp warn_if_token_missing do
    env = Application.get_env(:posthog_example, :env, :dev)
    test_mode? = Application.get_env(:posthog, :test_mode, false)

    if env != :prod and not test_mode? do
      case Application.get_env(:posthog, :api_key) do
        token when is_binary(token) ->
          if String.trim(token) == "" do
            log_missing_token_warning()
          end

        nil ->
          log_missing_token_warning()
      end
    end
  end

  defp log_missing_token_warning do
    Logger.warning(
      "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, " <>
        "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
    )
  end
end
