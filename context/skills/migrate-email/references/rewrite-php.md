---
title: Send with posthog-php
description: The PostHog side of a moved site in PHP
---

# Send with posthog-php

For a site in PHP, such as in a Laravel or Symfony app. A site that sends through Laravel's mailer stays on the provider: the provider's `mapping.md` says so.

## Install

`composer require posthog/posthog-php`, which installs or upgrades it to the latest release that the project's constraints allow. Raise the constraint in `composer.json` when it holds the package back.

## The client

```php
use PostHog\Client;

$posthog = new Client(
    getenv('POSTHOG_PROJECT_TOKEN') ?: null,
    [
        'host' => getenv('POSTHOG_HOST') ?: null,
        'migrated_from' => '<provider>', // only when the options take it
    ],
    loadFeatureFlags: false,
    secretKey: getenv('POSTHOG_PROJECT_SECRET_API_KEY') ?: null,
);
```

- Give email its own client, as above, and leave the app's `PostHog::init` as it is: calling `PostHog::init` again replaces the client the app's captures use. With a secret key, a client loads flag definitions with it when it starts, so the email client is built with `loadFeatureFlags: false`, which also keeps the key off a proxy.
- Create it once, such as in a service container binding, and use it where the sites send.
- The app host option is `app_host`.
- Read the env variables the way the app reads its provider key, such as `env()` or `$_ENV` in a framework.

## The send

- Code send: `$posthog->emails()->send(['to' => ..., 'template_key' => ..., 'subject' => ..., 'html' => ..., 'text' => ..., 'distinct_id' => ..., 'idempotency_key' => ...])`, with `'from'`, `'reply_to'`, `'capture_engagement'`, and `'track_opens_and_clicks'` optional. `'track_opens_and_clicks' => false` turns off open and click tracking.
- `'reply_to'` takes one address or a list of addresses.
- Template send: `$posthog->emails()->send(['to' => ..., 'template_id' => ..., 'template_data' => [...], 'distinct_id' => ..., 'idempotency_key' => ...])`.

## The answer

- The send returns a `SendEmailResult`. `getId()` is the message ID.
- On an API error it throws `PostHog\EmailError`. `getErrorCode()` is PostHog's error code, a string such as `recipient_suppressed`, `getErrorName()` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers", and `getStatusCode()` is the HTTP status.
- Suppressed recipient: `catch (\PostHog\EmailError $e)` with `if ($e->getErrorCode() === 'recipient_suppressed')`.
- It throws the same `PostHog\EmailError` for a network error that is left after the retries, with the code `network_error`, and for a bad argument, with a code that starts with `invalid_`. `getMessage()` is there too.

## Check

`php -l` on each changed file, and the project's static analyzer on the whole project when it has one, such as PHPStan or Psalm.
