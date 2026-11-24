---
title: Send with posthog-node
description: The PostHog side of a moved site in JavaScript or TypeScript on Node.js
---

# Send with posthog-node

For a site in JavaScript or TypeScript that runs on a server: Node.js, or an edge runtime such as Cloudflare Workers or Vercel Edge Functions, which posthog-node also supports. A site that runs in the browser never sends email: the secret key stays on the server.

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
- On an edge runtime without `process.env`, read the variables the way the app reads its provider key, such as from a Worker's `env`.

## Where the send runs

posthog-node runs in Node.js and in the edge runtimes above. A platform that runs code in a runtime of its own can bundle another entry of it, or none:

- Convex: posthog-node resolves to its Node.js entry under Convex's bundler, so it sends only from an action in a file that starts with `"use node"`. A mutation, a query, or an action in Convex's default runtime hands the send to an `internalAction` in such a file: an action calls it with `ctx.runAction(internal.<file>.<name>, args)`, and a mutation schedules it, or the action that a retrier or a workpool runs calls it. When the app already has a `"use node"` file that sends with posthog-node, add the action there. The client goes in that file too: code in Convex's default runtime must not import from a `"use node"` file. Code that builds the email's fields can stay in the site's file, and the action imports it from there. A send with files hands the action what each file comes from, such as its storage ID, and the action reads or builds the bytes. When only the site can make the bytes, pass them as an `ArrayBuffer` argument, validated with `v.bytes()`, and the action passes `new Uint8Array(bytes)` to the SDK: Convex values take no Buffer or `Uint8Array`. Convex limits the size of a function's arguments, and the limit depends on the call: a direct `ctx.runAction` call and a scheduled call have different limits, and the calls one mutation schedules share a total. Check the size of all the files together, with the email's other arguments, against Convex's limit for the call the site makes. When they can be larger than that limit, the site stays: `moves: no — its files can't cross into the Node.js runtime`.
- Convex typechecks a new action through `convex/_generated/api.d.ts`, which `convex codegen` writes. In a file that already exists, the new action typechecks without it. A new file needs `convex codegen`, which needs a configured deployment: when it fails, add the action to an existing `"use node"` file, or note that the person runs `convex dev` once.

## The send

- Code send: `posthog.emails.send({ templateKey, to, subject, html, text, distinctId, idempotencyKey })`, with `from`, `replyTo`, `sensitive`, and `tracking` optional. `tracking` takes `true`, `false`, or `{ opens, clicks, engagement }`. Open tracking off is `tracking: { opens: false }`, and with engagement off too, `tracking: { opens: false, engagement: false }`. `captureEngagement` is deprecated: use `tracking: { engagement: false }`. Sensitive is `sensitive: true`.
- `replyTo` takes one address or a list of addresses.
- Template send: `posthog.emails.send({ to, templateId, templateData, distinctId, idempotencyKey })`.
- A component the provider rendered, such as React Email, is rendered in the app with `render` from `@react-email/render`, and sent as `html`.

## A deadline

For a site whose request had its own deadline, as `7-rewrite.md` says under "Set up the client":

- The client's `emailRequestTimeoutMs` is the time each email request may take, 15000 by default, and `emailRequestMaxRetries` its retries, 2 by default. A send's `maxRetries: 0` turns its retries off.
- The send takes no abort signal, so a deadline needs a client of its own with `emailRequestTimeoutMs` set to it.

## The answer

- `posthog.emails.send` never throws on an API error: it returns `{ data, error }`. When the old call threw on an error, or the code checked an HTTP status, check `error` so the site fails the same way.
- `data.id` is the message ID.
- A network error that is left after the retries comes back as `error` with the code `network_error`. A bad argument comes back as `error` too, with a code that starts with `invalid_`.
- An error PostHog answered with a wait carries it as `error.retryAfterMs`, in milliseconds; it is unset when PostHog named none.
- `error.code` is PostHog's error code, such as `recipient_suppressed`. `error.name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers". `error.message` and `error.statusCode` are there too.
- Suppressed recipient: `if (error?.code === 'recipient_suppressed')`.

## A test

- posthog-node sends with the global `fetch`, so a fake on `globalThis.fetch`, or the `fetch` client option where the app passes one, answers it, as `8-verify.md` says.

## Check

The project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck.
