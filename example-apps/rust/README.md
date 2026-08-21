# PostHog Rust example

This is an [Axum](https://github.com/tokio-rs/axum) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side Rust SDK, [`posthog-rs`](https://crates.io/crates/posthog-rs).

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with users via person properties (`$set`)
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Capture exceptions with `capture_exception`
- **Server-side tracking**: All tracking happens server-side with the async Rust SDK
- **Single client per process**: One PostHog client for the whole app, flushed on shutdown

> **Note on SDK scope:** the `posthog-rs` server SDK does **not** provide an
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
├── Cargo.toml          # Crate + the posthog-rs dependency
├── .env.example        # Environment variable template
├── .gitignore          # Ignores /target and .env
└── src/
    └── main.rs         # Axum app: client init, routes, identify, events, flags, errors
```

## Key integration points

### PostHog client init (src/main.rs)

Build **one client per process** and share it through Axum state as an `Arc<Client>`. Never construct a new client per request.

```rust
let options = ClientOptions::from((token.as_str(), host.as_str()));
let client: Arc<Client> = Arc::new(posthog_rs::client(options).await);

let app = Router::new()
    // ...routes...
    .with_state(client.clone());
```

### Configuration from the environment (src/main.rs)

Read the token and host from the environment so secrets never live in source. A blank token logs a clear warning and the app still boots — fail loudly, but never break the app.

```rust
let token = std::env::var("POSTHOG_PROJECT_TOKEN").unwrap_or_default();
let host = std::env::var("POSTHOG_HOST")
    .unwrap_or_else(|_| "https://us.i.posthog.com".to_string());

if token.trim().is_empty() {
    tracing::warn!("POSTHOG_PROJECT_TOKEN is not set. PostHog events will NOT be delivered.");
}
```

The `(api_key, host)` tuple converts into `ClientOptions`, which is how this example applies `POSTHOG_HOST`.

### User identification (src/main.rs)

The server SDK identifies a user by attaching person properties to a capture with the `$set` property. The distinct id (2nd argument to `Event::new`) is the stable user id and must match the id your frontend `posthog.identify(...)` call uses.

```rust
let mut event = Event::new("user_logged_in", &user_id);
event.insert_prop("$set", serde_json::json!({ "email": email }))?;
event.insert_prop("login_method", "email")?;
client.capture(event); // fire-and-forget
```

### Event tracking (src/main.rs)

```rust
let mut event = Event::new("burrito_considered", &user_id);
event.insert_prop("total_considerations", count)?;
client.capture(event);
```

### Feature flags (src/main.rs)

Evaluate flags once per request with `evaluate_flags(...)`, then read individual flags off the returned snapshot. Avoid the deprecated per-flag helpers.

```rust
let flags = client
    .evaluate_flags(user_id, EvaluateFlagsOptions::default())
    .await?;
let show_new_feature = flags.is_enabled("new-dashboard-feature");
```

### Error tracking (src/main.rs)

Unlike some PostHog server SDKs, `posthog-rs` **does** capture exceptions. Report any `std::error::Error` with `capture_exception_with`, attaching the distinct id and context.

```rust
let options = CaptureExceptionOptions::new()
    .distinct_id(user_id)
    .property("source", "profile_view")?;
client.capture_exception_with(&err, options).await?;
```

### Flush and shutdown (src/main.rs)

`capture` is fire-and-forget, so queued events must be flushed before the process exits or they are lost. On graceful shutdown (Ctrl+C), flush and then shut the client down.

```rust
client.flush().await;
client.shutdown().await;
```

## Learn more

- [PostHog Rust SDK](https://posthog.com/docs/libraries/rust)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [Axum documentation](https://docs.rs/axum/latest/axum/)
