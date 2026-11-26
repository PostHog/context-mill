# PostHog React Router 7 Framework example

This is a [React Router 7](https://reactrouter.com) Framework example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **SSR Support**: Server-side rendering with React Router 7 Framework
- **Reverse Proxy**: PostHog ingestion through a React Router resource route

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). `.env.example` lists the variable names. Vite inlines both variables into the browser and the server build, so set them before `npm run build`; the server needs nothing at run time. If the token is missing, the app still builds and runs without PostHog and logs a warning.

### Requirements

- `onError` on `<HydratedRouter>` needs `react-router` 7.11 or later. On 7.8.2 to 7.10, the prop is `unstable_onError`, typed `unstable_ClientOnErrorFunction`. On earlier versions, capture inside a `useEffect` in every route `ErrorBoundary`, with the same checks.
- `createReactRouterErrorHandler` needs `posthog-node` 6.1.0 or later.

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the app.

## Project Structure

```
app/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context
├── lib/
│   ├── posthog.server.ts    # The server's one PostHog client and its React Router error handler
│   ├── posthog-middleware.ts # Server-side PostHog middleware
│   └── db.ts                # Database utilities
├── routes/
│   ├── home.tsx             # Home/Login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   ├── ingest.ts            # Reverse proxy to PostHog
│   ├── api.auth.login.ts    # Login API with server-side tracking
│   └── api.burrito.consider.ts # Burrito API with server-side tracking
├── entry.client.tsx         # Client entry with PostHog initialization and router error capture
├── entry.server.tsx         # Server entry with server error capture
└── root.tsx                 # Root route with error boundary
```

## Key Integration Points

### Client-side initialization (entry.client.tsx)

```typescript
import { isRouteErrorResponse, type ClientOnErrorFunction } from 'react-router';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: '/ingest',
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
    defaults: '2026-08-30',
    capture_exceptions: true,
    tracing_headers: [ window.location.hostname ],
  });
} else if (import.meta.env.DEV) {
  console.warn('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.');
}

// Errors React Router catches in the browser. Skip responses thrown on purpose (404s) and the
// sanitized copy of a server error: the server already captured it with its stack.
const onError: ClientOnErrorFunction = (error) => {
  if (isRouteErrorResponse(error)) return;
  if (error instanceof Error && error.message === "Unexpected Server Error") return;
  posthog.captureException(error);
};

<PostHogProvider client={posthog}>
  <HydratedRouter onError={onError} />
</PostHogProvider>
```

### User identification (home.tsx)

The user is identified when the user logs in on the **client-side**.

```typescript
posthog?.identify(username, {
  username: username,
});
posthog?.capture('user_logged_in', {
  username: username,
});
```

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers because we set the `tracing_headers` option in the PostHog initialization.

**Important**: do not identify users on the server-side.

### Server-side middleware (posthog-middleware.ts)

The server process has one PostHog client, created in `posthog.server.ts` with exception autocapture on. The middleware runs each request inside the browser's IDs from the tracing headers, so server events link to the user and session:

```typescript
export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  if (!posthog) {
    return next();
  }

  (context as PostHogContext).posthog = posthog;

  const header = (name: string) => request.headers.get(name)?.trim() || undefined;
  return posthog.withContext(
    { distinctId: header("x-posthog-distinct-id"), sessionId: header("x-posthog-session-id") },
    next,
    { fresh: true },
  );
};
```

**Key Points:**
- One client for the whole server process, or no PostHog when the token is missing
- Reads `distinctId` and `sessionId` from the tracing headers
- Sets the PostHog client on the request context for use in route handlers
- Uses `withContext()` to associate server-side events with the correct session/user
- Error capture does not need the middleware: `handleError` reads the request itself. Do not add loaders to make the middleware run.

On Vercel, Netlify or another serverless host, the function can stop as soon as the response is sent. Pass the platform's `waitUntil` as the client's `waitUntil` option, so queued events are still sent.

### Reverse proxy (ingest.ts)

Ad blockers drop events sent to PostHog's domain. This example sends them through your own domain instead. A splat resource route at `/ingest/*` forwards `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to PostHog's ingestion host. It sets the `host` header, removes cookies and non-PostHog credentials from the forwarded request, and strips content encoding so compressed responses are not double-decoded. The route exports a `loader` for GET requests and an `action` for POST requests.

The proxy follows the region in `VITE_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. It derives the ingestion host, the assets host (`-assets.i.posthog.com`), and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value, so an EU project only needs to set `VITE_PUBLIC_POSTHOG_HOST`. Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`. If you deploy somewhere that can't run server routes, use the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) instead.

### Event tracking (burrito.tsx)

```typescript
posthog?.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (entry.client.tsx, entry.server.tsx, profile.tsx)

React Router catches errors in rendering, loaders, actions and fetchers and shows the route's `ErrorBoundary`, so the `ErrorBoundary` only renders the error UI. Errors are captured in three places:

1. **Browser** - `capture_exceptions: true` plus the `onError` handler on `<HydratedRouter>` in `entry.client.tsx` (above).

2. **Server** - `entry.server.tsx` exports the `handleError` that `createReactRouterErrorHandler` from `posthog-node` creates in `posthog.server.ts`. It captures loader, action, middleware, resource route and server render errors with the page URL (not the `.data` URL of a client navigation) and the visitor: the IDs the middleware sets, then the `X-POSTHOG-*` tracing headers, then the posthog-js cookie that page loads send (`readPostHogCookie: true`). It skips cancelled requests, the 404 and 405 responses React Router creates, and visitors who opted out in the consent cookie. Errors raised while streaming, after the shell was sent, reach React's `onError` in the same file, which passes them to the same handler:
```typescript
import { createReactRouterErrorHandler, PostHog } from "posthog-node";

export const posthog = new PostHog(token, { host, enableExceptionAutocapture: true, readPostHogCookie: true });
export const handleError = createReactRouterErrorHandler(posthog);
```

   React Router does not call `handleError` for a promise a loader returns and the page renders with `<Await>`. Pass those rejections to the handler in the loader with `.catch((error) => { void handleError?.(error, { request }); throw error })`, and give the `<Await>` an `errorElement`.

3. **Manual error capture** in components (profile.tsx):
```typescript
posthog.captureException(err);
```

Test error capture with a production build (`npm run build && npm start`). In `react-router dev`, React Router sends the browser the original server error instead of "Unexpected Server Error", so each server error arrives twice: once from the server and once from the browser.

### Server-side tracking (api.auth.login.ts, api.burrito.consider.ts)

Server-side events use the PostHog client from the request context (set by the middleware):

```typescript
const posthog = (context as any).posthog as PostHog | undefined;
if (posthog) {
  posthog.capture({ event: 'server_login' });
}
```

**Key Points:**
- The PostHog client is available via `context.posthog` (set by the middleware)
- Events are automatically associated with the correct user/session via the middleware's `withContext()` call
- The `distinctId` and `sessionId` are extracted from request headers and used to maintain context between client and server

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 7 Documentation](https://reactrouter.com)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
