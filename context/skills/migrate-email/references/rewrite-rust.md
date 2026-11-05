---
title: Send with posthog-rs
description: The PostHog side of a moved site in Rust
---

# Send with posthog-rs

For a site in Rust.

## Install

`cargo add posthog-rs`, or `cargo update -p posthog-rs` when the app has it. An app that sends from async code uses the crate's `async-client` feature, and a blocking app uses the blocking client.

## The client

```rust
let mut options = posthog_rs::ClientOptionsBuilder::default();
options
    .api_key(std::env::var("POSTHOG_PROJECT_TOKEN")?)
    .host(std::env::var("POSTHOG_HOST")?)
    .secret_key(std::env::var("POSTHOG_PROJECT_SECRET_API_KEY")?)
    .migrated_from("<provider>"); // only when the builder has it
let posthog = posthog_rs::client(options.build()?).await;
```

- The client loads flag definitions only with `enable_local_evaluation` on, so a client that only sends email needs no other setting.
- The app host option is `app_host`.
- Create the client once, and share it where the sites send.

## The send

- Code send: `posthog.emails().send(CodeEmail::new(to, template_key, subject).html(...).text(...).distinct_id(...).idempotency_key(...))`, with `.from(...)`, `.reply_to(...)`, and `.capture_engagement(false)` optional.
- Template send: `posthog.emails().send(TemplateEmail::new(to, template_id).template_data(...).distinct_id(...).idempotency_key(...))`.
- With the async client, await the send.

## The answer

- The send returns a `Result`. On success, `SendEmailResult`'s `id` is the message ID.
- An API error is a `posthog_rs::EmailError`. `code()` is PostHog's error code, such as `recipient_suppressed`, `kind().as_str()` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `status()` is the HTTP status.
- Suppressed recipient: `Err(error) if error.code() == "recipient_suppressed"`.

## Check

`cargo check` with the features the app builds with.
