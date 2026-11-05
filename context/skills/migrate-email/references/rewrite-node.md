---
title: Send with posthog-node
description: The PostHog side of a moved site in JavaScript or TypeScript on Node.js
---

# Send with posthog-node

For a site in JavaScript or TypeScript that runs on Node.js. A site that runs in the browser never sends email: the secret key stays on the server.

## Install

Install or upgrade `posthog-node` to its latest release with the project's package manager. Install `@react-email/render` too when a site renders a component and the app doesn't have it.

## The client

```js
import { PostHog } from 'posthog-node'

export const posthog = new PostHog(process.env.POSTHOG_PROJECT_TOKEN, {
    host: process.env.POSTHOG_HOST,
    secretKey: process.env.POSTHOG_PROJECT_SECRET_API_KEY,
    enableLocalEvaluation: false,
    migratedFrom: '<provider>', // only when the client options take it
})
```

- The client polls feature flag definitions with the secret key, so a client that only sends email sets `enableLocalEvaluation: false`.
- The app host option is `appHost`.

## The send

- Code send: `posthog.emails.send({ templateKey, to, subject, html, text, distinctId, idempotencyKey })`, with `from`, `replyTo`, and `captureEngagement` optional.
- Template send: `posthog.emails.send({ to, templateId, templateData, distinctId, idempotencyKey })`.

## The answer

- `posthog.emails.send` never throws on an API error: it returns `{ data, error }`. When the old call threw on an error, or the code checked an HTTP status, check `error` so the site fails the same way.
- `data.id` is the message ID.
- `error.code` is PostHog's error code, such as `recipient_suppressed`. `error.name` is one of the coarse names the provider's `mapping.md` lists under "Code around the send". `error.message` and `error.statusCode` are there too.
- Suppressed recipient: `if (error?.code === 'recipient_suppressed')`.

## Check

The project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck.
