defmodule PostHogExampleWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :posthog_example

  # The session is stored in a signed cookie. We use it to remember the
  # logged-in user's stable distinct id across requests.
  @session_options [
    store: :cookie,
    key: "_posthog_example_key",
    signing_salt: "kE9xVq2p",
    same_site: "Lax"
  ]

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options

  # PostHog's built-in Plug. Placed before the router so every request is
  # wrapped in a PostHog context: it attaches request metadata ($current_url,
  # $host, $pathname, ...) and reads the X-PostHog-Distinct-Id /
  # X-PostHog-Session-Id tracing headers to link backend and frontend events.
  plug PostHog.Integrations.Plug

  plug PostHogExampleWeb.Router
end
