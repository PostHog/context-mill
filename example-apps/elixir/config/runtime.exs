import Config

# runtime.exs runs at boot in every environment, which makes it the right
# place to read environment variables.

# Trim POSTHOG_PROJECT_TOKEN and disable the SDK when unset or blank rather than
# passing an empty or placeholder string as api_key.
token =
  case System.get_env("POSTHOG_PROJECT_TOKEN") do
    nil ->
      nil

    raw ->
      case String.trim(raw) do
        "" -> nil
        trimmed -> trimmed
      end
  end

host =
  case System.get_env("POSTHOG_HOST") do
    nil ->
      "https://us.i.posthog.com"

    raw ->
      case String.trim(raw) do
        "" -> "https://us.i.posthog.com"
        trimmed -> trimmed
      end
  end

if config_env() != :test do
  posthog_opts =
    [
      enable: token not in [nil, ""],
      api_host: host
    ] ++ if(token not in [nil, ""], do: [api_key: token], else: [])

  config :posthog, posthog_opts
end

# In production, require a real secret_key_base from the environment.
if config_env() == :prod do
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE is missing. Generate one with `mix phx.gen.secret`."

  config :posthog_example, PostHogExampleWeb.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: String.to_integer(System.get_env("PORT") || "8000")],
    secret_key_base: secret_key_base
end
