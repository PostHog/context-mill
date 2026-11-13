---
title: Send with the posthog Elixir SDK
description: The PostHog side of a moved site in Elixir
---

# Send with the posthog Elixir SDK

For a site in Elixir, such as in a Phoenix app. A site that sends through the Swoosh mailer adapter stays on the provider: the provider's `mapping.md` says so.

## Install

Add `{:posthog, "~> <latest version>"}` to the deps in `mix.exs`, or raise the version there, then run `mix deps.get`.

## The client

Give email a named instance of its own in the application's children, also when the app doesn't use PostHog yet. When the app has a `:posthog` config, leave it as it is:

```elixir
{PostHog.Supervisor,
 PostHog.Config.validate!(
   supervisor_name: MyApp.PostHogEmail,
   api_host: System.get_env("POSTHOG_HOST") || Application.get_env(:posthog, :api_host) || "https://us.i.posthog.com",
   api_key: System.get_env("POSTHOG_PROJECT_TOKEN") || Application.get_env(:posthog, :api_key) || "",
   secret_key: System.get_env("POSTHOG_PROJECT_SECRET_API_KEY"),
   enable_local_evaluation: false,
   migrated_from: "<provider>" # only when the config takes it
 )}
```

- With `secret_key` set, the SDK loads flag definitions from `api_host` with it when it starts. `enable_local_evaluation: false` stops that, so the key needs no flag scope. Behind a reverse proxy, set the instance's `api_host` to PostHog's own host, as Step 7 says. Turning it off on the app's existing config would break the flags the app evaluates locally, so the existing config keeps its own settings.
- `api_host` and `api_key` must be strings, and a `nil` stops the app from starting, so each one falls back as above: to the app's own `:posthog` value, then, when that is unset or `nil`, to the US Cloud host and an empty token. Use `https://eu.i.posthog.com` for EU Cloud. `secret_key` can be `nil`, and a send without it fails with its own error.
- The app host option is `app_host`.
- Name the instance after the app, such as `MyApp.PostHogEmail`, and pass that name first to each call below.

## The send

- Code send: `PostHog.Emails.send(MyApp.PostHogEmail, to: ..., template_key: ..., subject: ..., html: ..., text: ..., distinct_id: ..., idempotency_key: ...)`, with `from:`, `reply_to:`, `capture_engagement:`, and `sensitive: true` optional.
- `reply_to:` takes one address or a list of addresses.
- Template send: `PostHog.Emails.send(MyApp.PostHogEmail, to: ..., template_id: ..., template_data: %{...}, distinct_id: ..., idempotency_key: ...)`.

## A deadline

For a site whose request had its own deadline, as `7-rewrite.md` says under "Set up the client":

- The config's `email_request_timeout_ms` is the time each email request may take, 15000 by default, and `email_request_max_retries` its retries, 2 by default. A send's `max_retries: 0` turns its retries off.
- The send takes no deadline of its own, so a deadline needs a named instance of its own, as above, with `email_request_timeout_ms` set to it.

## The answer

- The send returns `{:ok, result}`, and `result.id` is the message ID.
- An API error is `{:error, %PostHog.Emails.Error{}}`. `code` is PostHog's error code, a string such as `"recipient_suppressed"`, and `name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", as an atom, such as `:rate_limit_exceeded`.
- Suppressed recipient: match `{:error, %PostHog.Emails.Error{code: "recipient_suppressed"}}`.
- A network error that is left after the retries is the same `{:error, %PostHog.Emails.Error{}}`, with the code `"network_error"`, and so is a bad argument, with a code that starts with `invalid_`. `message` and `status_code` are there too.

## Check

`mix compile --force`, comparing its warnings with the ones Step 7 kept: an undefined function shows only as a warning.
