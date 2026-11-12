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
  feature_flags_async_load: true,
  migrated_from: '<provider>' # only when the client takes it
})
```

- With `secret_key` set, the client loads flag definitions from `host` with it, and keeps polling. Give the key the feature flag read scope too. Tell the person. `feature_flags_async_load: true` loads them on the polling thread, so a slow answer never holds the app's boot; set it on any client that gets the key.
- The app host option is `app_host`.
- In Rails, create the client once, such as in an initializer.

## The send

- Code send: `POSTHOG.emails.send(to:, template_key:, subject:, html:, text:, distinct_id:, idempotency_key:)`, with `from:`, `reply_to:`, and `capture_engagement:` optional.
- `reply_to:` takes one address or a list of addresses.
- Template send: `POSTHOG.emails.send(to:, template_id:, template_data:, distinct_id:, idempotency_key:)`.

## A deadline

For a site whose request had its own deadline, as `7-rewrite.md` says under "Set up the client":

- The client's `email_request_timeout_seconds:` is the time each email request may take, 15 by default, and `email_request_max_retries:` its retries, 2 by default. A send's `max_retries: 0` turns its retries off.
- The send takes no deadline of its own, so a deadline needs a client of its own with `email_request_timeout_seconds:` set to it.
- The SDK sets `Net::HTTP`'s open, read and write timeouts to that number, which limits each wait on the network, not the whole request. `Net::HTTP`'s own timeouts, and Faraday's `timeout` on its default `net_http` adapter, are the same kind of limit, and the SDK keeps one only when the request sets open, read and write to one number. A request that sets only some of them, such as only `read_timeout: 3`, which leaves the others at `Net::HTTP`'s 60 seconds, or sets them to different numbers, is a mix the SDK can't keep: the site stays. A limit on the whole request, such as Typhoeus's `timeout` or Faraday's `timeout` on another adapter, such as `:typhoeus`, is a deadline the SDK can't keep: the site stays, as Step 7 says. A `Timeout.timeout` the code puts around the call is code around the send and stays around it.

## The answer

- The send returns a `SendResult`. Its `id` is the message ID.
- On an API error it raises `PostHog::EmailError`. `code` is PostHog's error code, such as `recipient_suppressed`, `name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `status_code` is the HTTP status.
- Suppressed recipient: `rescue PostHog::EmailError => e` with `if e.code == 'recipient_suppressed'`.
- It raises the same `PostHog::EmailError` for a network error that is left after the retries, with the code `network_error`. `message` is there too.
- A bad argument raises `ArgumentError`, before any request.

## Check

`ruby -c` on each changed file, the project's type checker on the whole project when it has one, such as Sorbet or Steep, and the app's boot, such as `bin/rails runner 'true'` in Rails.
