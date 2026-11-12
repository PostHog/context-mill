---
title: Send with posthog-rs
description: The PostHog side of a moved site in Rust
---

# Send with posthog-rs

For a site in Rust.

## Install

`cargo add posthog-rs`, also when the app has it: it moves the version requirement to the latest release, which `cargo update` doesn't do across a 0.x minor version. An app that sends from async code uses the crate's `async-client` feature, and a blocking app builds without it.

## The client

```rust
let mut options = posthog_rs::ClientOptionsBuilder::default();
options
    .api_key(std::env::var("POSTHOG_PROJECT_TOKEN").unwrap_or_default())
    .host(std::env::var("POSTHOG_HOST").unwrap_or_default())
    .secret_key(std::env::var("POSTHOG_PROJECT_SECRET_API_KEY").unwrap_or_default())
    .migrated_from("<provider>"); // only when the builder has it
let posthog = posthog_rs::client(options.build()?).await; // with `async-client`
// let posthog = posthog_rs::client(options.build()?); // without it, the blocking client
```

- The client loads flag definitions only with `enable_local_evaluation` on, so a client that only sends email needs no other setting.
- The app host option is `app_host`.
- Create the client once, and share it where the sites send. A blank secret key counts as none, so a send without it fails with its own error.
- The crate builds one client: the async one with the `async-client` feature, and the blocking one without it. Use the one the app's features give. A site whose code doesn't match it, such as a blocking site in an app built with `async-client`, stays, with the reason `posthog-rs builds only the <async|blocking> client here`.

## The send

- Code send: `posthog.emails().send(CodeEmail::new(to, template_key, subject).html(...).text(...).distinct_id(...).idempotency_key(...))`, with `.from(...)`, `.reply_to(...)`, and `.capture_engagement(false)` optional.
- Template send: `posthog.emails().send(TemplateEmail::new(to, template_id).template_data(...).distinct_id(...).idempotency_key(...))`.
- With the async client, await the send.
- Call `.reply_to(...)` once per address.

## A deadline

For a site whose request had its own deadline, as `7-rewrite.md` says under "Set up the client":

- The builder's `email_request_timeout_seconds` is the time each email request may take, 15 by default, in whole seconds, and `email_request_max_retries` its retries, 2 by default. A send's `.max_retries(0)` turns its retries off.
- The send takes no deadline of its own, so a deadline needs a client of its own with `email_request_timeout_seconds` set to it. A deadline that is not whole seconds can't be kept: the site stays.

## The answer

- The send returns a `Result`. On success, `SendEmailResult`'s `id` is the message ID.
- An API error is a `posthog_rs::EmailError`. `code()` is PostHog's error code, such as `recipient_suppressed`, `kind().as_str()` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `status()` is the HTTP status.
- Suppressed recipient: `Err(error) if error.code() == "recipient_suppressed"`.
- A network error that is left after the retries is the same `EmailError`, with the code `network_error`, and so is a bad argument, with a code that starts with `invalid_`.

## Check

`cargo check` with the features the app builds with.
