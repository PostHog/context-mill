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
use PostHog\PostHog;

PostHog::init(
    client: new Client(
        getenv('POSTHOG_PROJECT_TOKEN'),
        [
            'host' => getenv('POSTHOG_HOST'),
            'migrated_from' => '<provider>', // only when the options take it
        ],
        loadFeatureFlags: false,
        secretKey: getenv('POSTHOG_PROJECT_SECRET_API_KEY'),
    ),
);
```

- With a secret key, the client loads flag definitions with it when it starts, so a client that only sends email is built with `loadFeatureFlags: false`. An app that already calls `PostHog::init` with the key and evaluates flags keeps its client, and the key needs the feature flag read scope too.
- The app host option is `app_host`.
- Read the env variables the way the app reads its provider key, such as `env()` or `$_ENV` in a framework.

## The send

- Code send: `PostHog::emails()->send(['to' => ..., 'template_key' => ..., 'subject' => ..., 'html' => ..., 'text' => ..., 'distinct_id' => ..., 'idempotency_key' => ...])`, with `'from'`, `'reply_to'`, and `'capture_engagement'` optional.
- Template send: `PostHog::emails()->send(['to' => ..., 'template_id' => ..., 'template_data' => [...], 'distinct_id' => ..., 'idempotency_key' => ...])`.

## The answer

- The send returns a `SendEmailResult`. `getId()` is the message ID.
- On an API error it throws `PostHog\EmailError`. `getErrorCode()` is PostHog's error code, a string such as `recipient_suppressed`, `getErrorName()` is one of the coarse names the provider's `mapping.md` lists under "Code around the send", and `getStatusCode()` is the HTTP status.
- Suppressed recipient: `catch (\PostHog\EmailError $e)` with `if ($e->getErrorCode() === 'recipient_suppressed')`.

## Check

`php -l` on each changed file, and the project's static analyzer when it has one, such as PHPStan or Psalm.
