import Config

config :posthog_example, env: config_env()

# Endpoint configuration. The secret_key_base here is a throwaway dev value.
# Override it in prod via runtime.exs and SECRET_KEY_BASE.
config :posthog_example, PostHogExampleWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  http: [ip: {127, 0, 0, 1}, port: 8000],
  render_errors: [formats: [html: PostHogExampleWeb.ErrorHTML], layout: false],
  secret_key_base:
    "dev_only_secret_key_base_replace_in_prod_0123456789abcdefghijklmnopqrstuvwxyz",
  server: true

# PostHog SDK starts one supervised client per app when enabled in runtime.exs.
#   in_app_otp_apps -> which OTP app stack frames count as in_app for error grouping
config :posthog,
  in_app_otp_apps: [:posthog_example]

config :phoenix, :json_library, Jason

if File.exists?(Path.expand("#{config_env()}.exs", __DIR__)) do
  import_config "#{config_env()}.exs"
end
