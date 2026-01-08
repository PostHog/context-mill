# PostHog React Router 7 Framework example

This is a [React Router 7](https://reactrouter.com) Framework example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **SSR Support**: Server-side rendering with React Router 7 Framework

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
VITE_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

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
│   ├── posthog-middleware.ts # Server-side PostHog middleware
│   └── db.ts                # Database utilities
├── routes/
│   ├── home.tsx             # Home/Login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   ├── api.auth.login.ts    # Login API with server-side tracking
│   └── api.burrito.consider.ts # Burrito API with server-side tracking
├── entry.client.tsx         # Client entry with PostHog initialization
├── entry.server.tsx         # Server entry
└── root.tsx                 # Root route with error boundary
```

## Key Integration Points

### Client-side initialization (entry.client.tsx)

```typescript
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
  __add_tracing_headers: [ window.location.host, 'localhost' ],
});

<PostHogProvider client={posthog}>
  <HydratedRouter />
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

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers because we set the `__add_tracing_headers` option in the PostHog initialization.

**Important**: do not identify users on the server-side.

### Server-side middleware (posthog-middleware.ts)

The PostHog middleware creates a server-side PostHog client for each request and extracts session and user context from request headers:

```typescript
export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  const posthog = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY!, {
    host: process.env.VITE_PUBLIC_POSTHOG_HOST!,
    flushAt: 1,
    flushInterval: 0,
  });

  const sessionId = request.headers.get('X-POSTHOG-SESSION-ID');
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID');

  context.posthog = posthog;

  const response = await posthog.withContext(
    { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
    next
  );

  await posthog.shutdown().catch(() => {});
  return response;
};
```

**Key Points:**
- Creates a new PostHog Node client for each request
- Extracts `sessionId` and `distinctId` from request headers (automatically set by the client-side SDK)
- Sets the PostHog client on the request context for use in route handlers
- Uses `withContext()` to associate server-side events with the correct session/user
- Properly shuts down the client after each request

### Event tracking (burrito.tsx)

```typescript
posthog?.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (root.tsx, profile.tsx)

Errors are captured in two ways:

1. **Error boundary** - The `ErrorBoundary` in `root.tsx` automatically captures unhandled React Router errors:
```typescript
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const posthog = usePostHog();
  posthog.captureException(error);
  // ... error UI
}
```

2. **Manual error capture** in components (profile.tsx):
```typescript
posthog.captureException(err);
```

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
