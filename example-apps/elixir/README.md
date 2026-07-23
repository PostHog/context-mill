# PostHog Phoenix (Elixir) example

This is a [Phoenix](https://www.phoenixframework.org/) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side [`posthog`](https://hex.pm/packages/posthog) Elixir SDK.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with users via the `distinct_id` on capture
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Automatic exception + `Logger.error` capture (built into the SDK)
- **Server-side tracking**: All tracking happens server-side with the Elixir SDK
- **Single client per app**: The SDK starts one supervised client for the whole app
- **Context plug**: `PostHog.Integrations.Plug` tags every request automatically

> **Note on error tracking:** unlike the Java/Python examples, the PostHog Elixir
> SDK captures errors **automatically** — it hooks into Elixir's `Logger`, so any
> `Logger.error` call and any uncaught exception is reported without an explicit
> call. There is no documented `capture_exception` function, so the profile page
> demonstrates the idiomatic path (`Logger.error`) plus an explicit
> `error_occurred` event.

## Getting started

### 1. Install dependencies

```bash
mix deps.get
```

### 2. Configure environment variables

Copy `.env.example` to `.env`, fill in your values, then export them:

```bash
export POSTHOG_PROJECT_TOKEN=your_posthog_project_token
export POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the development server

```bash
mix phx.server
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
elixir/
├── mix.exs                          # Project + the posthog dependency
├── .env.example                     # Environment variable template
├── .gitignore
├── config/
│   ├── config.exs                   # Endpoint + PostHog SDK config (enable, otp apps)
│   └── runtime.exs                  # Reads POSTHOG_* env vars at boot
└── lib/
    ├── posthog_example/
    │   └── application.ex            # OTP app; warns loudly on a blank token
    ├── posthog_example_web.ex        # controller / html / router helpers
    └── posthog_example_web/
        ├── endpoint.ex               # Plug pipeline incl. PostHog.Integrations.Plug
        ├── router.ex                 # Routes for the burrito app
        └── controllers/
            ├── burrito_controller.ex # Events, identify, flags, errors
            ├── burrito_html.ex       # Tiny HEEx pages
            ├── layouts.ex            # Root layout
            └── error_html.ex         # Error pages
```

## Key integration points

### Configuration from the environment (config/runtime.exs)

`runtime.exs` runs at boot, so it can read environment variables. The token and host never live in source.

```elixir
config :posthog,
  api_key: System.get_env("POSTHOG_PROJECT_TOKEN"),
  api_host: System.get_env("POSTHOG_HOST") || "https://us.i.posthog.com"
```

### SDK init — one client per app (config/config.exs)

The SDK starts and supervises a single client for the whole app automatically. You only turn it on and tell it which OTP app is "in app" for error grouping:

```elixir
config :posthog,
  enable: true,
  in_app_otp_apps: [:posthog_example]
```

A blank token doesn't crash the app — `application.ex` logs a clear warning and boots anyway.

### Context plug (lib/posthog_example_web/endpoint.ex)

Add the built-in plug before your router. It wraps each request in a PostHog context: it attaches request metadata (`$current_url`, `$host`, `$pathname`, …) and reads the `X-PostHog-Distinct-Id` / `X-PostHog-Session-Id` tracing headers to link backend and frontend events.

```elixir
plug PostHog.Integrations.Plug
plug PostHogExampleWeb.Router
```

### User identification (lib/posthog_example_web/controllers/burrito_controller.ex)

The Elixir SDK has no separate server-side `identify` step — you identify a user by passing their `distinct_id` on `capture`. It must match the id your frontend `posthog.identify(...)` uses so both sides attach to the same person.

```elixir
PostHog.capture("user_logged_in", %{
  distinct_id: distinct_id,
  login_method: "email"
})
```

### Event tracking (lib/posthog_example_web/controllers/burrito_controller.ex)

`distinct_id` is required; every other key in the map becomes an event property.

```elixir
PostHog.capture("burrito_considered", %{
  distinct_id: distinct_id,
  total_considerations: count
})
```

### Feature flags (lib/posthog_example_web/controllers/burrito_controller.ex)

Evaluate flags once per request, then read individual flags off the returned snapshot.

```elixir
show_new_feature =
  case PostHog.FeatureFlags.evaluate_flags(distinct_id) do
    {:ok, snapshot} ->
      PostHog.FeatureFlags.Evaluations.enabled?(snapshot, "new-dashboard-feature")

    _error ->
      false
  end
```

### Error tracking (lib/posthog_example_web/controllers/burrito_controller.ex)

Error tracking is **automatic** — the SDK is built on Elixir's `Logger`, so uncaught exceptions and `Logger.error` calls are captured with no explicit call. There is no documented `capture_exception`, so we log the error (auto-captured) and also send an explicit analytics event:

```elixir
try do
  raise "Something went wrong while loading the burrito profile!"
rescue
  error ->
    Logger.error("Burrito profile error: #{Exception.message(error)}")

    PostHog.capture("error_occurred", %{
      distinct_id: distinct_id,
      error_message: Exception.message(error)
    })
end
```

Disable automatic capture with `config :posthog, enable_error_tracking: false`.

## Learn more

- [PostHog Elixir SDK](https://posthog.com/docs/libraries/elixir)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [Phoenix framework](https://www.phoenixframework.org/)
