# PostHog Phoenix (Elixir) example

This is a [Phoenix](https://www.phoenixframework.org/) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side [`posthog`](https://hex.pm/packages/posthog) Elixir SDK.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with users via a stable UUID `distinct_id` on capture, while signed-out visitors get a per-visit random UUID and personless events
- **Feature flags**: Evaluate flags once per request and enrich subsequent captures via `PostHog.FeatureFlags.set_in_context/1`
- **Error tracking**: Automatic exception and `Logger.error` capture built into the SDK
- **Server-side tracking**: All tracking happens server-side with the Elixir SDK
- **Single client per app**: The SDK starts one supervised client for the whole app when configured
- **Context plug**: `PostHog.Integrations.Plug` tags every request automatically

> **Note on error tracking:** unlike the Java or Python examples, the PostHog Elixir
> SDK captures errors **automatically** by hooking into Elixir `Logger`, so any
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

Copy `.env.example` to `.env`, add your project token, and export the variables:

```bash
cp .env.example .env
# Edit .env and set POSTHOG_PROJECT_TOKEN, then export:
export $(grep -v '^#' .env | xargs)
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
│   ├── config.exs                   # Endpoint + PostHog OTP app config
│   ├── test.exs                     # Enables test_mode and disables live sender in tests
│   └── runtime.exs                  # Reads POSTHOG_* env vars at boot
└── lib/
    ├── posthog_example/
    │   └── application.ex            # OTP app, logs missing-token warning outside prod
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

## What the integration sets up for you

From the SDK docs (https://posthog.com/docs/libraries/elixir):

**Automatic**

- The SDK starts and supervises its own client when `config :posthog, enable: true` and a non-empty `api_key` is set, and attaches a logger handler. You add nothing to your supervision tree.
- Events are batched and sent by a background worker.
- Error tracking is on by default: uncaught exceptions and `Logger.error` calls are captured (turn it off with `enable_error_tracking: false`).
- `PostHog.Integrations.Plug` adds `$current_url`, `$host`, `$pathname`, `$request_method`, `$user_agent` and `$ip` to events captured during a request, and reads the `X-PostHog-Distinct-Id` and `X-PostHog-Session-Id` headers as default context.
- Context set with `PostHog.set_context/1` is stored in `Logger` metadata and attached to events captured in the same process.

**Still done by the app**

- Capturing every event with `PostHog.capture/2` because the plug captures nothing on its own.
- Choosing the `distinct_id` (signed-in UUID, or a per-visitor UUID) and passing it or putting it in context.
- Evaluating feature flags with `PostHog.FeatureFlags.evaluate_flags/1` and attaching accessed flags with `PostHog.FeatureFlags.set_in_context/1`.
- Reading the token and host from the environment in `config/runtime.exs`.
- Handling missing tokens: `runtime.exs` sets `enable: token not in [nil, ""]` without passing `""` as `api_key`, and `application.ex` logs a warning outside `:prod`.

This example loads no browser SDK, so there is no `posthog-js` or reverse proxy setup here. If you add `posthog-js`, set `defaults: '2026-08-30'` and see the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md).

## Key integration points

### Configuration from the environment (`config/runtime.exs` and `config/test.exs`)

`runtime.exs` trims `POSTHOG_PROJECT_TOKEN` at boot and only enables the SDK when a real token is configured, while `config/test.exs` sets `test_mode: true, enable: false`:

```elixir
token =
  case System.get_env("POSTHOG_PROJECT_TOKEN") do
    nil -> nil
    raw ->
      case String.trim(raw) do
        "" -> nil
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
```

### SDK config (`config/config.exs`)

Tell the SDK which OTP app frames count as in-app for error grouping:

```elixir
config :posthog,
  in_app_otp_apps: [:posthog_example]
```

### Context plug (`lib/posthog_example_web/endpoint.ex`)

Add the built-in plug before your router so each request gets PostHog context metadata and `X-PostHog-Distinct-Id` / `X-PostHog-Session-Id` header support:

```elixir
plug PostHog.Integrations.Plug
plug PostHogExampleWeb.Router
```

### User identification and signed-out visitors (`lib/posthog_example_web/controllers/burrito_controller.ex`)

The Elixir SDK has no separate server-side `identify` function. Reject blank login inputs before capturing, assign each authenticated user a stable UUID `distinct_id`, and send `username` in `$set` person properties rather than top-level event properties:

```elixir
PostHog.capture("user_logged_in", %{
  distinct_id: distinct_id,
  login_method: "username",
  "$set": %{username: username}
})
```

A `plug :assign_identity` in the controller picks the ID for every request:

- **Signed in**: the stable UUID stored in the session at login.
- **Signed out**: a random UUID generated once and kept in the session (`:visitor_id`) for the visit, with `$process_person_profile: false` so signed-out visitors are never merged into a shared `"anonymous"` person ([anonymous vs identified events](https://posthog.com/docs/data/anonymous-vs-identified-events.md)).

On `/logout`, `user_logged_out` is captured only when `!conn.assigns.anonymous?`.

### Event tracking (`lib/posthog_example_web/controllers/burrito_controller.ex`)

`distinct_id` is required, and every other key in the map becomes an event property:

```elixir
PostHog.capture("burrito_considered", %{
  distinct_id: distinct_id,
  total_considerations: count
})
```

### Feature flags (`lib/posthog_example_web/controllers/burrito_controller.ex`)

Evaluate flags once per request, read individual flags off the snapshot, and attach accessed flags to the process context with `set_in_context/1`:

```elixir
show_new_feature =
  case PostHog.FeatureFlags.evaluate_flags(distinct_id) do
    {:ok, snapshot} ->
      enabled =
        PostHog.FeatureFlags.Evaluations.enabled?(snapshot, "new-dashboard-feature")

      PostHog.FeatureFlags.set_in_context(
        PostHog.FeatureFlags.Evaluations.only_accessed(snapshot)
      )

      enabled

    _error ->
      false
  end
```

### Error tracking (`lib/posthog_example_web/controllers/burrito_controller.ex`)

Error tracking is automatic through Elixir `Logger`, so uncaught exceptions and `Logger.error` calls are captured without an explicit helper:

```elixir
try do
  raise "Something went wrong while loading the burrito profile!"
rescue
  error ->
    Logger.error("Burrito profile error: #{Exception.message(error)}")

    PostHog.capture("error_occurred", %{
      distinct_id: distinct_id,
      error_type: error.__struct__ |> Module.split() |> List.last(),
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
