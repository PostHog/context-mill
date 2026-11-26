# PostHog TanStack Start example

This is a [TanStack Start](https://tanstack.com/start) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors automatically
- **User authentication**: Demo login system with PostHog user identification and session restore
- **Server-side & client-side tracking**: Complete examples of both tracking methods
- **Reverse proxy**: PostHog ingestion through a TanStack Start server route

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the root directory and set your project token:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). Leave `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` blank until you have a real token. When the token is unset, the app still builds and runs, logs an error in browser development builds and a warning on the server outside production, and skips PostHog initialization.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project structure

```
src/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── utils/
│   └── posthog-server.ts    # Server-side PostHog client
├── routes/
│   ├── __root.tsx           # Root route with PostHogProvider
│   ├── index.tsx            # Home/login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   ├── ingest.$.ts          # Reverse proxy to PostHog
│   └── api/
│       ├── auth/
│       │   └── login.ts     # Login API with server-side tracking
│       └── burrito/
│           └── consider.ts  # Burrito API with server-side tracking
└── styles.css               # Global styles

.env                         # Environment variables
```

## Key integration points

### Client-side initialization (`src/routes/__root.tsx`)

PostHog is initialized using `PostHogProvider` from `@posthog/react`. The provider wraps the app in the root shell component only when `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` is configured:

```tsx
import { PostHogProvider } from '@posthog/react'

{posthogToken ? (
  <PostHogProvider
    apiKey={posthogToken}
    options={{
      api_host: '/ingest',
      ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes('eu.')
        ? 'https://eu.posthog.com'
        : 'https://us.posthog.com',
      defaults: '2026-08-30',
      capture_exceptions: true,
      debug: import.meta.env.DEV,
      tracing_headers:
        typeof window !== 'undefined' ? [window.location.hostname] : [],
    }}
  >
    {app}
  </PostHogProvider>
) : (
  app
)}
```

Without a token, browser builds log an error in development (`typeof window !== 'undefined'`) and render the app without `PostHogProvider`.

### Server-side setup (`src/utils/posthog-server.ts`)

For server-side tracking, use the `posthog-node` SDK with a singleton pattern that returns `null` when unconfigured:

```typescript
import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null
let hasWarnedMissingToken = false

export function getPostHogClient(): PostHog | null {
  const rawToken =
    process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ??
    import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
  const token =
    typeof rawToken === 'string' && rawToken.trim()
      ? rawToken.trim()
      : undefined

  if (!token) {
    if (
      !import.meta.env.PROD &&
      process.env.NODE_ENV !== 'production' &&
      !hasWarnedMissingToken
    ) {
      hasWarnedMissingToken = true
      console.warn(
        'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host:
        process.env.VITE_PUBLIC_POSTHOG_HOST ||
        import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
        'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }
  return posthogClient
}
```

### Server-side capture (`src/routes/api/*`)

Server-side events include the client's `$session_id` so they appear in the same session in PostHog. The `tracing_headers` option on `PostHogProvider` adds the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers to same-origin requests automatically, so the frontend fetch needs no manual PostHog headers:

```typescript
// Client: tracing_headers is configured once on the PostHogProvider
options={{
  api_host: '/ingest',
  // Guarded for SSR, where window is undefined.
  tracing_headers: typeof window !== 'undefined' ? [window.location.hostname] : [],
}}

// Frontend fetch, no manual PostHog headers needed
await fetch('/api/burrito/consider', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: user.id, totalConsiderations: nextCount }),
})
```

```typescript
// Server: require userId, read session ID from header, and await flush safely
import { getPostHogClient } from '../../../utils/posthog-server'

const trimmedUserId = typeof userId === 'string' ? userId.trim() : ''
if (!trimmedUserId) {
  return json({ error: 'User id is required' }, { status: 400 })
}

const sessionId = request.headers.get('X-PostHog-Session-Id')
const posthog = getPostHogClient()

if (posthog && trimmedUserId) {
  posthog.capture({
    distinctId: trimmedUserId,
    event: 'burrito_considered',
    properties: {
      $session_id: sessionId || undefined,
      total_considerations: totalConsiderations,
      source: 'api',
    },
  })

  await posthog.flush().catch(() => {})
}
```

### Reverse proxy (`src/routes/ingest.$.ts`)

Ad blockers drop events sent to PostHog's domain. This example sends them through your own domain instead. A server route at `/ingest/$` forwards `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to PostHog's ingestion host. It sets the `host` header and removes cookies and non-PostHog credentials from the forwarded request. Because it is a server route, it works in development and in production builds.

```typescript
export const Route = createFileRoute('/ingest/$')({
  server: {
    handlers: {
      GET: proxyToPostHog,
      POST: proxyToPostHog,
    },
  },
})
```

The proxy follows the region in `VITE_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. It derives the ingestion host, the assets host (`-assets.i.posthog.com`), and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value, so an EU project only needs to set `VITE_PUBLIC_POSTHOG_HOST`. Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`. If you deploy somewhere that can't run server routes, use the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) instead.

### User identification (`src/contexts/AuthContext.tsx`)

Identify users with their stable user ID on login and when restoring a persisted session from `localStorage`, keeping `username` in person properties:

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog.identify(user.id, {
  username: user.username,
})
posthog.capture('user_logged_in', {
  login_method: 'username',
})
```

### Event tracking (`src/routes/burrito.tsx`)

Keep PII such as `username` out of event properties:

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog.capture('burrito_considered', {
  total_considerations: nextCount,
  source: 'client',
})
```

### Error tracking (`src/routes/profile.tsx`)

```typescript
posthog.captureException(error)
```

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [TanStack Start documentation](https://tanstack.com/start)
- [TanStack Router documentation](https://tanstack.com/router)
- [PostHog React integration](https://posthog.com/docs/libraries/react)
- [PostHog Node.js integration](https://posthog.com/docs/libraries/node)
