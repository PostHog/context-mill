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

- Convex: posthog-node resolves to its Node.js entry under Convex's bundler, so it sends only from an action in a file that starts with `"use node"`. A mutation, a query, or an action in Convex's default runtime hands the send to an `internalAction` in such a file: an action calls it with `ctx.runAction(internal.<file>.<name>, args)`, and a mutation schedules it, or the action that a retrier or a workpool runs calls it. When the app already has a `"use node"` file that sends with posthog-node, add the action there. The client goes in that file too: code in Convex's default runtime must not import from a `"use node"` file. Code that builds the email's fields can stay in the site's file, and the action imports it from there.
- Convex typechecks a new action through `convex/_generated/api.d.ts`, which `convex codegen` writes. In a file that already exists, the new action typechecks without it. A new file needs `convex codegen`, which needs a configured deployment: when it fails, add the action to an existing `"use node"` file, or note that the person runs `convex dev` once.

## The send

- Code send: `posthog.emails.send({ templateKey, to, subject, html, text, distinctId, idempotencyKey })`, with `from`, `replyTo`, `sensitive`, and `tracking` optional. `tracking` takes `true`, `false`, or `{ opens, clicks, engagement }`. Open tracking off is `tracking: { opens: false }`, and with engagement off too, `tracking: { opens: false, engagement: false }`. `captureEngagement` is deprecated: use `tracking: { engagement: false }`. Sensitive is `sensitive: true`.
- `replyTo` takes one address or a list of addresses.
- Files: `attachments: [{ filename, content, contentType, contentId }]`, up to 10, with `contentType` and `contentId` optional. `content` is a Buffer, a `Uint8Array`, or a Base64 string: pass a file's text as `Buffer.from(text)`. A release whose send has no attachments field doesn't take files yet: upgrade as Step 7 says, and when the latest release has none either, the site stays.
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
- `error.code` is PostHog's error code, such as `recipient_suppressed`. `error.name` is one of the coarse names that `7-rewrite.md` lists under "What every SDK's send takes and answers". `error.message` and `error.statusCode` are there too.
- Suppressed recipient: `if (error?.code === 'recipient_suppressed')`.
- A send with files can fail with `invalid_attachment`, `too_many_attachments`, or `message_too_large` before any request, and with `attachment_upload_failed` when a file's upload failed. Each sends nothing.

## A test

- posthog-node sends with the global `fetch`, so a fake on `globalThis.fetch`, or the `fetch` client option where the app passes one, answers it, as `8-verify.md` says.
- posthog-node hashes each file with `crypto.subtle.digest`, which settles on a later turn of the event loop, after any timer a faked clock fires meanwhile. A test that fakes the clock and sends files replaces it for the test with a hash that settles at once: `const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementation((_algorithm, data) => Promise.resolve(Uint8Array.from(createHash('sha256').update(ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data)).digest()).buffer))`, with `createHash` from `node:crypto`, and restores it after with `digest.mockRestore()`, which still works when a test's own `vi.restoreAllMocks()` ran first. Never write a hash of your own. When the tests' folder can't import `node:crypto`, as in Convex's `convex/` folder, whose lint refuses Node modules and whose typecheck has no Node types, put the stub in a test setup file outside that folder, such as `vitest.convex-setup.ts` at the root, set in a `beforeEach` and restored in an `afterEach`, and add it to the `setupFiles` of the test project that runs those tests. A fake of PostHog's email API that several test files share goes next to it, outside that folder, for the same reason.

## Check

The project's typecheck, such as its `typecheck` script or `tsc --noEmit`, or its build when it has no typecheck.
