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

Copy `.env.example` to `.env` in the root directory and set your project token:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). `.env.example` lists the variable names. Vite inlines both variables into the browser and the server build, so set them before `npm run build` and the server needs nothing extra at run time. If the token is missing, the app still builds and runs without PostHog. The browser logs an error in development, and the server logs a warning once outside production.

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
│   └── AuthContext.tsx      # Authentication context with PostHog identification
├── lib/
│   ├── posthog.server.ts    # The server's singleton PostHog client and React Router error handler
│   ├── posthog-middleware.ts # Server-side PostHog middleware
│   └── db.ts                # Database utilities
├── routes/
│   ├── home.tsx             # Home/Login page
│   ├── burrito.tsx          # Demo feature page
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
import { isRouteErrorResponse, type ClientOnErrorFunction } from "react-router";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";

// Read the project token without a fallback value. When it is missing, leave the client uninitialized()
// and PostHogProvider rather than initializing the SDK with a placeholder key.
const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: "/ingest",
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes("eu.")
      ? "https://eu.posthog.com"
      : "https://us.posthog.com",
    defaults: "2026-08-30",
    capture_exceptions: true,
    tracing_headers: [window.location.hostname],
  });
} else if (import.meta.env.DEV) {
  console.error("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured");
}

// Errors React Router catches in the browser. Skip responses thrown on purpose (404s) and the
// sanitized copy of a server error because the server already captured it with its stack.
const onError: ClientOnErrorFunction = (error) => {
  if (!posthogToken) return;
  if (isRouteErrorResponse(error)) return;
  if (error instanceof Error && error.message === "Unexpected Server Error") return;
  posthog.captureException(error);
};

{posthogToken ? <PostHogProvider client={posthog}>{app}</PostHogProvider> : app}
```

### User identification (AuthContext.tsx, Header.tsx)

Users are identified on the client-side with the stable UUID (`authenticatedUser.id`) returned by `/api/auth/login` on login, and re-identified when restoring a persisted session from `localStorage` on reload. `username` is passed only as a person property, never as `distinctId` or in `capture()` event properties.

```typescript
posthog?.identify(authenticatedUser.id, { username: authenticatedUser.username });
posthog?.capture('user_logged_in', { login_method: 'username' });
```

On logout from an active session, capture `user_logged_out` before calling `reset()`:

```typescript
if (user) {
  posthog?.capture('user_logged_out');
  posthog?.reset();
}
```

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers because `tracing_headers` is enabled in `posthog.init`. Do not call `identify()` on the server-side.

### Server-side middleware (posthog-middleware.ts)

The server process has one singleton PostHog client created in `posthog.server.ts` (or `null` when the token is unset). The middleware extracts the browser's tracing headers and runs each request inside `withContext()` without inventing fallback IDs:

```typescript
export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  if (!posthog) {
    return next();
  }

  const distinctId = request.headers.get("x-posthog-distinct-id")?.trim() || undefined;
  const sessionId = request.headers.get("x-posthog-session-id")?.trim() || undefined;

  const posthogContext = context as PostHogContext;
  posthogContext.posthog = posthog;
  posthogContext.distinctId = distinctId;

  if (!distinctId && !sessionId) {
    return next();
  }

  return posthog.withContext(
    {
      ...(distinctId ? { distinctId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    next,
    { fresh: true },
  );
};
```

**Key Points:**
- One singleton client for the server process, or `null` when the project token is missing
- Reads `distinctId` and `sessionId` from the tracing headers without literal fallbacks
- Sets the PostHog client and `distinctId` on the request context for route handlers
- Uses `withContext()` to associate server-side events with the browser session
- Error capture does not need the middleware because `handleError` reads the request itself

On Vercel, Netlify, or another serverless host, the function can stop as soon as the response is sent. Pass the platform's `waitUntil` as the client's `waitUntil` option, and await `posthog.flush().catch(() => {})` in short-lived route handlers.

### Reverse proxy (ingest.ts)

Ad blockers drop events sent to PostHog's domain. This example sends them through your own domain instead. A splat resource route at `/ingest/*` forwards `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to PostHog's ingestion host. It sets the `host` header, removes cookies and non-PostHog credentials from the forwarded request, and strips content encoding so compressed responses are not double-decoded. The route exports a `loader` for GET requests and an `action` for POST requests.

The proxy follows the region in `VITE_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. It derives the ingestion host, the assets host (`-assets.i.posthog.com`), and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value, so an EU project only needs to set `VITE_PUBLIC_POSTHOG_HOST`. Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`. If you deploy somewhere that cannot run server routes, use the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) instead.

### Server-side tracking (api.auth.login.ts, api.burrito.consider.ts)

Server route actions read `posthog` and `distinctId` from the request context, skip `capture()` when `distinctId` is missing, omit PII from event properties, and flush cleanly before returning:

```typescript
const { posthog, distinctId } = context as PostHogContext;
if (posthog && distinctId) {
  posthog.capture({
    distinctId,
    event: "burrito_considered",
    properties: { total_considerations: burritoConsiderations },
  });
  await posthog.flush().catch(() => {});
}
```

### Error tracking (entry.client.tsx, entry.server.tsx, profile.tsx)

React Router catches errors in rendering, loaders, actions, and fetchers and shows the route's `ErrorBoundary`, so the `ErrorBoundary` only renders the error UI. Errors are captured in three places:

1. **Browser**: `capture_exceptions: true` plus the `onError` handler on `<HydratedRouter>` in `entry.client.tsx` (above).

2. **Server**: `entry.server.tsx` exports the `handleError` that `createReactRouterErrorHandler` from `posthog-node` creates in `posthog.server.ts`. It captures loader, action, middleware, resource route, and server render errors with the page URL (not the `.data` URL of a client navigation) and the visitor: the IDs the middleware sets, then the `X-POSTHOG-*` tracing headers, then the posthog-js cookie that page loads send (`readPostHogCookie: true`). It skips cancelled requests, the 404 and 405 responses React Router creates, and visitors who opted out in the consent cookie. Errors raised while streaming, after the shell was sent, reach React's `onError` in the same file, which passes them to the same handler:
```typescript
import { createReactRouterErrorHandler, PostHog } from "posthog-node";

export const posthog = token
  ? new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
      readPostHogCookie: true,
    })
  : null;

export const handleError = posthog ? createReactRouterErrorHandler(posthog) : undefined;
```

   React Router does not call `handleError` for a promise a loader returns and the page renders with `<Await>`. Pass those rejections to the handler in the loader with `.catch((error) => { void handleError?.(error, { request }); throw error })`, and give the `<Await>` an `errorElement`.

3. **Manual error capture** in components (profile.tsx):
```typescript
posthog?.captureException(err);
```

Test error capture with a production build (`npm run build && npm start`). In `react-router dev`, React Router sends the browser the original server error instead of "Unexpected Server Error", so each server error arrives twice: once from the server and once from the browser.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 7 Documentation](https://reactrouter.com)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
