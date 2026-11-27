# PostHog Rust example

This is an [Axum](https://github.com/tokio-rs/axum) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side Rust SDK, [`posthog`](https://crates.io/crates/posthog).

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a stable UUID via person properties (`$set`), while signed-out visitors get a random cookie UUID and personless events
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Capture exceptions with `capture_exception_with`
- **Server-side tracking**: All tracking happens server-side with the async Rust SDK
- **Single client per process**: One PostHog client for the whole app when configured, flushed on shutdown

> **Note on SDK scope:** the `posthog` server SDK does **not** provide an
> `alias` helper, surveys, or session replay. This example does not scaffold or
> promise any of those. It uses only documented methods: `capture`,
> `evaluate_flags`, `capture_exception_with`, `flush`, and `shutdown`.

## Getting started

### 1. Configure environment variables

Copy `.env.example` to `.env`, fill in your values, and export them:

```bash
export POSTHOG_PROJECT_TOKEN=your_posthog_project_token
export POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

### 2. Run the app

```bash
cargo run
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
rust/
├── Cargo.toml          # Crate + the posthog dependency
├── .env.example        # Environment variable template
├── .gitignore          # Ignores /target and .env
└── src/
    └── main.rs         # Axum app: optional client init, routes, identify, events, flags, errors
```

## Key integration points

### PostHog client init and configuration (src/main.rs)

Read `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` optionally from the environment so secrets never live in source. When `POSTHOG_PROJECT_TOKEN` is missing or empty, log a warning outside production and store `None` in Axum state rather than calling `posthog::client` with a blank key. When configured, build **one client per process** and share it as `Option<Arc<Client>>`.

```rust
let token = std::env::var("POSTHOG_PROJECT_TOKEN")
    .ok()
    .map(|v| v.trim().to_string())
    .filter(|v| !v.is_empty());

let host = std::env::var("POSTHOG_HOST")
    .ok()
    .map(|v| v.trim().to_string())
    .filter(|v| !v.is_empty())
    .unwrap_or_else(|| "https://us.i.posthog.com".to_string());

let posthog_client = match token {
    Some(token) => {
        let options = ClientOptions::from((token.as_str(), host.as_str()));
        Some(Arc::new(posthog::client(options).await))
    }
    None => {
        if cfg!(debug_assertions)
            || std::env::var("APP_ENV").as_deref() != Ok("production")
        {
            tracing::warn!(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
            );
        }
        None
    }
};
```

### User identification (src/main.rs)

Validate login input and return `StatusCode::BAD_REQUEST` when empty without setting cookies or capturing events. Map each login account to a stable UUID so `distinct_id` is never raw PII, and include `"email"` or `"username"` in `$set` only when non-empty.

```rust
if let Some(client) = &state.posthog {
    let mut event = Event::new("user_logged_in", &distinct_id);
    let _ = event.insert_prop("$set", serde_json::Value::Object(person_props));
    let _ = event.insert_prop("login_method", login_method);
    client.capture(event);
}
```

### Signed-out visitors (src/main.rs)

The `visitor` helper returns the cookie jar, the distinct id, and whether the visitor is anonymous. Signed-in users (a non-empty `user_id` cookie) keep their stable UUID. For everyone else it generates a random UUID, stores it in an `anon_id` cookie so it is reused for the rest of the visit, and `mark_anonymous` sets `$process_person_profile` to `false` on their events so PostHog does not create a person profile for them.

```rust
let (jar, user_id, anonymous) = visitor(jar);

if let Some(client) = &state.posthog {
    let mut event = Event::new("burrito_considered", &user_id);
    if anonymous {
        let _ = event.insert_prop("$process_person_profile", false);
    }
    client.capture(event);
}
```

Feature flags use the same visitor id, so flag evaluation works for anonymous visitors too.

### Event tracking (src/main.rs)

```rust
if let Some(client) = &state.posthog {
    let mut event = Event::new("burrito_considered", &user_id);
    let _ = event.insert_prop("total_considerations", count);
    mark_anonymous(&mut event, anonymous);
    client.capture(event);
}
```

### Feature flags (src/main.rs)

Evaluate flags once per request with `evaluate_flags(...)` when PostHog is configured, then read individual flags off the returned snapshot. Avoid the deprecated per-flag helpers.

```rust
if let Some(client) = &state.posthog {
    let flags = client
        .evaluate_flags(user_id, EvaluateFlagsOptions::default())
        .await?;
    let show_new_feature = flags.is_enabled("new-dashboard-feature");
}
```

### Error tracking (src/main.rs)

Report any `std::error::Error` with `capture_exception_with`, attaching the distinct id and non-PII context.

```rust
if let Some(client) = &state.posthog {
    let options = CaptureExceptionOptions::new()
        .distinct_id(user_id)
        .property("source", "profile_view")?;
    client.capture_exception_with(&err, options).await?;
}
```

### Flush and shutdown (src/main.rs)

`capture` is fire-and-forget, so queued events must be flushed before the process exits or they are lost. On graceful shutdown (Ctrl+C), flush and shut the client down when configured.

```rust
if let Some(client) = &state.posthog {
    client.flush().await;
    client.shutdown().await;
}
```

## Learn more

- [PostHog Rust SDK](https://posthog.com/docs/libraries/rust)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [Axum documentation](https://docs.rs/axum/latest/axum/)
