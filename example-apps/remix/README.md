# PostHog Remix example

A [Remix](https://remix.run) v2 (Vite) app demonstrating PostHog with `posthog-js` in the browser and `posthog-node` on the server, plus a reverse proxy served by a Remix resource route.

Using Remix v3? It is now React Router v7 framework mode. See the `react-react-router-7-framework` example instead.

## Features

- **Product analytics**: autocapture, pageviews and custom events from the browser and the server
- **Session replay**: recordings start with `posthog-js`
- **Feature flags**: `useFeatureFlagEnabled()` gates a tip on the burrito page
- **Error tracking**: an `ErrorBoundary` and `captureException()` in the browser, and Remix's `handleError` on the server
- **User identification**: a demo sign-in that calls `identify()`, and a sign-out that calls `reset()`
- **Server and browser linked**: `tracing_headers` sends the PostHog distinct id and session id to the server routes
- **Reverse proxy**: PostHog traffic goes through `/ingest`

## Getting started

### 1. Install dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your project token from your [PostHog project settings](https://app.posthog.com/project/settings). Use `https://eu.i.posthog.com` as the host for an EU Cloud project.

Vite reads these at build time, so rebuild after you change them. If the token is missing, the app still builds and runs, skips PostHog, and logs a warning outside production.

### 3. Run the app

```bash
pnpm dev   # http://localhost:5173
pnpm build && pnpm start
```

## Project structure

```
app/
├── auth.tsx             # In-memory demo auth context
├── entry.server.tsx     # Server entry, handleError reports server errors
├── posthog.server.ts    # posthog-node client and capture helpers
├── provider.tsx         # posthog-js initialization and PostHogProvider
├── root.tsx             # Layout, providers and ErrorBoundary
└── routes/
    ├── _index.tsx       # Sign-in page: identify and reset
    ├── burrito.tsx      # Server action with a server-side event, feature flag, error capture
    └── ingest.$.tsx     # Reverse proxy to PostHog
```

## Key integration points

### Browser initialization (provider.tsx)

```typescript
posthog.init(token, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-08-30",
  tracing_headers: [window.location.hostname],
});
```

`posthog-js` and `@posthog/react` are listed under `ssr.noExternal` in `vite.config.ts` so Vite bundles them for server rendering. `PHProvider` initializes PostHog after hydration and wraps the app in `PostHogProvider`.

### Identify and reset (routes/_index.tsx)

```typescript
posthog.identify(username, { username });
posthog.capture("user_logged_in");

posthog.reset(); // on sign-out
```

Identify once when the user signs in, with your own stable user id (a primary key or UUID, never an email), and call `reset()` on sign-out.

### Server-side client (posthog.server.ts)

One `PostHog` client is created per process. Remix handlers are short-lived, so it sends each event straight away (`flushAt: 1`, `flushInterval: 0`, a short `requestTimeout`, no retries) and each helper awaits `posthog.flush().catch(() => {})` so a PostHog outage never fails a request.

```typescript
posthog.capture({
  distinctId: identity.distinctId,
  event,
  properties: { ...properties, ...identity.properties },
});
await posthog.flush().catch(() => {});
```

Identity belongs to the request. `posthog-js` adds `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers to same-origin requests, and the helpers use them so server events land on the same person and session as the browser. A request without them gets a random id and `$process_person_profile: false`, so it never shares one person with other visitors.

### Server events (routes/burrito.tsx)

```typescript
await captureEvent(request, "burrito_considered", { total_considerations: count });
```

### Server errors (entry.server.tsx)

Remix handles many loader and action errors inside its router, so the `handleError` export reports them:

```typescript
export function handleError(error: unknown, { request }: { request: Request }) {
  if (request.signal.aborted) return;

  console.error(error);
  void captureError(request, error);
}
```

### Feature flags and browser errors

```typescript
const showTip = useFeatureFlagEnabled("burrito-tip");

posthog.captureException(error); // in the root ErrorBoundary and in event handlers
```

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. This example sends them through your own domain instead, following the [Remix reverse proxy guide](https://posthog.com/docs/advanced/proxy/remix). The splat resource route `app/routes/ingest.$.tsx` forwards `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to the ingestion host. It sets the `host` header, removes cookies and non-PostHog credentials from the forwarded request, and strips content encoding so compressed responses are not decoded twice. It exports a `loader` for GET requests and an `action` for POST requests.

The region comes from `VITE_PUBLIC_POSTHOG_HOST`. The route derives the ingestion host, the assets host (`-assets.i.posthog.com`) and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value.

Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`. Every PostHog request passes through your server, which can add bandwidth cost on serverless hosts. The [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md) avoids that.

## Learn more

- [PostHog Remix docs](https://posthog.com/docs/libraries/remix)
- [Remix docs](https://remix.run/docs)
