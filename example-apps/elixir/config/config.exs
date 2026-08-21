import Config

# Endpoint configuration. The secret_key_base here is a throwaway dev value;
# override it in prod via runtime.exs / an environment variable.
config :posthog_example, PostHogExampleWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  http: [ip: {127, 0, 0, 1}, port: 8000],
  render_errors: [formats: [html: PostHogExampleWeb.ErrorHTML], layout: false],
  secret_key_base:
    "dev_only_secret_key_base_replace_in_prod_0123456789abcdefghijklmnopqrstuvwxyz",
  server: true

# PostHog SDK — one client per app, started automatically by the SDK's
# own supervisor. The token and host are read from the environment in
# config/runtime.exs so secrets never live in source control.
#
#   enable            -> master on/off switch for the SDK
#   in_app_otp_apps   -> which OTP apps' stack frames count as "in app" for
#                        automatic error tracking (grouping / noise control)
config :posthog,
  enable: true,
  in_app_otp_apps: [:posthog_example]

config :phoenix, :json_library, Jason
