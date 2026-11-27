import Config

# Drop events in test mode and skip starting the live PostHog supervisor during tests.
config :posthog,
  test_mode: true,
  enable: false

config :posthog_example, PostHogExampleWeb.Endpoint,
  server: false
