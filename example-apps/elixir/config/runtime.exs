import Config

# runtime.exs runs at boot in every environment, which makes it the right
# place to read environment variables (they are not available at compile time).

# Configuration from the environment. Never hardcode the token.
#   POSTHOG_PROJECT_TOKEN -> your project's write key
#   POSTHOG_HOST          -> defaults to PostHog US Cloud
config :posthog,
  api_key: System.get_env("POSTHOG_PROJECT_TOKEN"),
  api_host: System.get_env("POSTHOG_HOST") || "https://us.i.posthog.com"

# In production, require a real secret_key_base from the environment.
if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE is missing. Generate one with `mix phx.gen.secret`."

  config :posthog_example, PostHogExampleWeb.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: String.to_integer(System.get_env("PORT") || "8000")],
    secret_key_base: secret_key_base
end
