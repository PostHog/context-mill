# PostHog Cloudflare Workers example

A [Cloudflare Workers](https://developers.cloudflare.com/workers/) example showing PostHog product analytics, user identification, feature flags, and error tracking with `posthog-node`, using the Workers pattern for short-lived handlers.

## Features

- **Product analytics**: capture a custom event (`burrito_considered`) per request
- **User identification**: identify on login with a stable user UUID and person properties (`$set`), while signed-out visitors get a per-visit cookie UUID and personless events
- **Feature flags**: evaluate a flag with `evaluateFlags()` and fall back to off if PostHog is unreachable
- **Error tracking**: report handled and unhandled errors with `captureExceptionImmediate()`
- **Flush before the Worker ends**: events are sent with `ctx.waitUntil()` so they are not lost after the response

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

To add the SDK to your own Worker:

```bash
pnpm add posthog-node
```

### 2. Configure environment variables

`wrangler.toml` declares `POSTHOG_HOST` under `[vars]` and leaves `POSTHOG_PROJECT_TOKEN` unset rather than defaulting it to an empty string. For local development, copy `.dev.vars.example` to `.dev.vars` and set `POSTHOG_PROJECT_TOKEN` to your project token:

```bash
cp .dev.vars.example .dev.vars
```

For a deployed Worker, store the token with `wrangler secret put POSTHOG_PROJECT_TOKEN`. Use `https://eu.i.posthog.com` as `POSTHOG_HOST` for EU Cloud.

A missing token never breaks the Worker. PostHog returns `null` so events are skipped, and a warning naming `POSTHOG_PROJECT_TOKEN` is logged once per isolate unless `ENVIRONMENT` is `production`.

### 3. Run the Worker

```bash
pnpm dev
```

Open [http://localhost:8787](http://localhost:8787). Check the build without deploying:

```bash
pnpm typecheck
pnpm build
```

## Project structure

```
cloudflare-workers/
├── wrangler.toml        # Worker config and non-secret vars
├── .dev.vars.example    # Local environment template
├── tsconfig.json
├── package.json
└── src/
    ├── posthog.ts       # Creates the per-request PostHog client from env bindings
    └── index.ts         # Routes: login, events, flags, error tracking
```

## Key integration points

### Client (src/posthog.ts)

Workers can stop right after the response is sent, so the client sends every event immediately instead of batching. Network timeouts are short and retries are off so PostHog never stalls a request. Return `null` when `POSTHOG_PROJECT_TOKEN` is unset instead of passing an empty key.

```ts
const token = env.POSTHOG_PROJECT_TOKEN?.trim()
if (!token) return null

return new PostHog(token, {
  host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
  flushAt: 1,
  flushInterval: 0,
  requestTimeout: 2000,
  fetchRetryCount: 0,
  enableExceptionAutocapture: true,
})
```

### Sending events before the Worker ends (src/index.ts)

Start each send without awaiting it, then hand the promises and `shutdown()` to `ctx.waitUntil()`. The response is not delayed and the Worker stays alive until the events are sent.

```ts
track(posthog?.captureImmediate({ distinctId: visitor.id, event: 'burrito_considered' }))

ctx.waitUntil(
  Promise.all(pending).finally(() => posthog?.shutdown().catch(() => {}))
)
```

### User identification (src/index.ts)

Validate that the login input is non-empty before setting cookies or capturing. Map the account to your app's stable UUID as `distinctId` instead of raw email, and include `email` in `$set` only when non-empty.

```ts
if (!email) {
  return new Response('Email is required', { status: 400 })
}

const userId = await userIdForEmail(email)
track(
  posthog?.captureImmediate({
    distinctId: userId,
    event: 'user_logged_in',
    properties: {
      login_method: 'email',
      ...(email ? { $set: { email } } : {}),
    },
  })
)
```

### Signed-out visitors (src/index.ts)

Visitors without a `user_id` cookie get a random UUID in an `anon_id` cookie, reused for the visit instead of sharing a literal `anonymous` id. Their events set `process_person_profile` to `false` so PostHog creates no person profile.

```ts
const anonymousOptions = visitor.anonymous ? { process_person_profile: false } : {}
```

### Feature flags (src/index.ts)

Awaiting the flag is the one place the response waits on PostHog, so errors are caught and the flag falls back to off.

```ts
const flags = await posthog?.evaluateFlags(visitor.id)
const showNewFeature = flags?.isEnabled('new-dashboard-feature') ?? false
```

### Error tracking (src/index.ts)

```ts
track(
  posthog?.captureExceptionImmediate(error, {
    distinctId: visitor.id,
    options: anonymousOptions,
  })
)
```

## Reverse proxy

A Worker sends events from the server, so ad blockers do not affect it and it does not need a reverse proxy. If your Worker serves a browser app that uses `posthog-js`, see [Using Cloudflare as a reverse proxy](https://posthog.com/docs/advanced/proxy/cloudflare.md).

## Learn more

- [PostHog Cloudflare Workers docs](https://posthog.com/docs/libraries/cloudflare-workers.md)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node.md)
