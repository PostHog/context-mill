---
title: Send with the posthog Elixir SDK
description: The PostHog side of a moved site in Elixir
---

# Send with the posthog Elixir SDK

For a site in Elixir, such as in a Phoenix app. A site that sends through the Swoosh mailer adapter stays on the provider: the provider's `mapping.md` says so.

## Install

Add `{:posthog, "~> <latest version>"}` to the deps in `mix.exs`, or raise the version there, then run `mix deps.get`.

## The client

Set the keys in the `:posthog` config, in `config/runtime.exs` so they come from the environment at run time:

```elixir
config :posthog,
  api_host: System.get_env("POSTHOG_HOST"),
  api_key: System.get_env("POSTHOG_PROJECT_TOKEN"),
  secret_key: System.get_env("POSTHOG_PROJECT_SECRET_API_KEY"),
  migrated_from: "<provider>" # only when the config takes it
```

- With `secret_key` set, the SDK loads flag definitions with it when it starts, so an app that only sends email with it sets `enable_local_evaluation: false`. Otherwise give the key the feature flag read scope too.
- The app host option is `app_host`.

## The send

- Code send: `PostHog.Emails.send(to: ..., template_key: ..., subject: ..., html: ..., text: ..., distinct_id: ..., idempotency_key: ...)`, with `from:`, `reply_to:`, and `capture_engagement:` optional.
- Template send: `PostHog.Emails.send(to: ..., template_id: ..., template_data: %{...}, distinct_id: ..., idempotency_key: ...)`.

## The answer

- The send returns `{:ok, result}`, and `result.id` is the message ID.
- An API error is `{:error, %PostHog.Emails.Error{}}`. `code` is PostHog's error code, a string such as `"recipient_suppressed"`, and `name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", as an atom, such as `:rate_limit_exceeded`.
- Suppressed recipient: match `{:error, %PostHog.Emails.Error{code: "recipient_suppressed"}}`.

## Check

`mix compile`.
