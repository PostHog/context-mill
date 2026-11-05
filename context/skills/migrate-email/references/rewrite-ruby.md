---
title: Send with posthog-ruby
description: The PostHog side of a moved site in Ruby
---

# Send with posthog-ruby

For a site in Ruby, such as in a Rails app. A site that sends through Rails' mailer stays on the provider: the provider's `mapping.md` says so.

## Install

`bundle add posthog-ruby`. When the app has it, raise its version constraint in the `Gemfile` when the constraint holds back the latest release, then run `bundle update posthog-ruby`. Require it with `require 'posthog'`.

## The client

```ruby
POSTHOG = PostHog::Client.new({
  api_key: ENV['POSTHOG_PROJECT_TOKEN'],
  host: ENV['POSTHOG_HOST'],
  secret_key: ENV['POSTHOG_PROJECT_SECRET_API_KEY'],
  migrated_from: '<provider>' # only when the client takes it
})
```

- With `secret_key` set, the client loads flag definitions with it when it starts, so give the key the feature flag read scope too. Tell the person.
- The app host option is `app_host`.
- In Rails, create the client once, such as in an initializer.

## The send

- Code send: `POSTHOG.emails.send(to:, template_key:, subject:, html:, text:, distinct_id:, idempotency_key:)`, with `from:`, `reply_to:`, and `capture_engagement:` optional.
- Template send: `POSTHOG.emails.send(to:, template_id:, template_data:, distinct_id:, idempotency_key:)`.

## The answer

- The send returns a `SendResult`. Its `id` is the message ID.
- On an API error it raises `PostHog::EmailError`. `code` is PostHog's error code, such as `recipient_suppressed`, `name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `status_code` is the HTTP status.
- Suppressed recipient: `rescue PostHog::EmailError => e` with `if e.code == 'recipient_suppressed'`.

## Check

`ruby -c` on each changed file, the project's type checker on the whole project when it has one, such as Sorbet or Steep, and the app's boot, such as `bin/rails runner 'true'` in Rails.
