# PostHog Integration

This document outlines all PostHog integrations in the React Router 7 Framework example application.

## Table of Contents

- [Dependencies](#dependencies)
- [Client-Side Initialization](#client-side-initialization)
- [Server-Side Middleware](#server-side-middleware)
- [Client-Side Integrations](#client-side-integrations)
- [Server-Side Integrations](#server-side-integrations)
- [Configuration](#configuration)

---

## Dependencies

**File:** `package.json`

The following PostHog packages are installed:

- `@posthog/react` (^1.5.2) - React hooks and provider for PostHog
- `posthog-js` (^1.310.1) - Client-side PostHog JavaScript SDK
- `posthog-node` (^5.18.0) - Server-side PostHog Node.js SDK

---

## Client-Side Initialization

### Entry Point Setup

**File:** `app/entry.client.tsx`

PostHog is initialized on the client side when the app hydrates:

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

**Key Points:**
- Initializes PostHog with API key and host from environment variables
- Wraps the app with `PostHogProvider` to make PostHog available via React hooks
- Configures tracing headers using `__add_tracing_headers` option

---

## Server-Side Middleware

### PostHog Middleware

**File:** `app/lib/posthog-middleware.ts`

A middleware function that creates a PostHog Node client for each server request:

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
- Extracts `sessionId` and `distinctId` from request headers
- Sets the PostHog client on the request context for use in route handlers
- Uses `withContext()` to associate events with the correct session/user
- Properly shuts down the client after each request

**Registration:** `app/root.tsx` (line 18-20)
```typescript
export const middleware: Route.MiddlewareFunction[] = [
  posthogMiddleware,
];
```

---

## Client-Side event captures

### 1. Home Component (Login)

**File:** `app/routes/home.tsx`

Tracks user authentication events when login is successful:

- **User Identification** (after successful login):
  ```typescript
  posthog?.identify(username, {
    username: username,
  });
  ```
  - Called when user successfully logs in
  - Uses username as the distinct ID

- **Login Event** (after successful login):
  ```typescript
  posthog?.capture('user_logged_in', {
    username: username,
  });
  ```
  - Captures a login event with username property

**Note:** User identification only happens on the client side, which is the correct pattern. The PostHog calls are made in the component that handles the login form submission, not in the authentication context.

---

### 2. Header Component

**File:** `app/components/Header.tsx`

Tracks logout events:

- **Logout Event** (line 10):
  ```typescript
  posthog?.capture('user_logged_out');
  ```

- **Reset User** (line 11):
  ```typescript
  posthog?.reset();
  ```
  - Resets PostHog state when user logs out
  - Clears user identification

---

### 3. Error Boundary

**File:** `app/root.tsx` (ErrorBoundary component, line 69-70)

Captures unhandled errors:

```typescript
const posthog = usePostHog();
posthog.captureException(error);
```

**Note:** This captures errors that bubble up to the React Router error boundary.

---

### 4. Profile Page

**File:** `app/routes/profile.tsx`

Includes a test error tracking feature:

- **Error Capture** (line 36):
  ```typescript
  posthog.captureException(err);
  ```
  - Used in a test button to demonstrate error tracking
  - Manually throws and captures an error for testing purposes

**Note:** There's an unused import `import posthog from 'posthog-js'` on line 5 that should be removed.

---

## Server-Side Integrations

### 1. Login API Route

**File:** `app/routes/api.auth.login.ts`

Captures server-side login events:

```typescript
const posthog = (context as any).posthog as PostHog | undefined;
if (posthog) {
  posthog.capture({ event: 'server_login' });
}
```

**Key Points:**
- Uses the PostHog Node client from request context
- Captures a `server_login` event when authentication succeeds
- Events are automatically associated with the user via `distinctId` from headers (set by middleware)

---

### 2. Burrito Consideration API Route

**File:** `app/routes/api.burrito.consider.ts`

Captures server-side burrito consideration events:

```typescript
const posthog = (context as any).posthog as PostHog | undefined;
if (posthog) {
  posthog.capture({ event: 'burrito_considered' });
}
```

**Key Points:**
- Uses the PostHog Node client from request context
- Captures a `burrito_considered` event when a user considers a burrito
- Events are automatically associated with the user via `distinctId` from headers

---

## Configuration

### Vite Configuration

**File:** `vite.config.ts`

PostHog-specific Vite configuration:

1. **SSR External Configuration** (line 12):
   ```typescript
   ssr: {
     noExternal: ['posthog-js', '@posthog/react'],
   },
   ```
   - Ensures PostHog packages are bundled for SSR instead of being treated as externals

2. **Proxy Configuration** (line 15-21):
   ```typescript
   server: {
     proxy: {
       '/ingest': {
         target: env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/ingest/, ''),
       },
     },
   },
   ```
   - Proxies PostHog ingestion requests through the dev server
   - Helps avoid CORS issues during development

---

## Environment Variables

Required environment variables:

- `VITE_PUBLIC_POSTHOG_KEY` - PostHog project API key
- `VITE_PUBLIC_POSTHOG_HOST` - PostHog instance host (e.g., `https://us.i.posthog.com`)

---

## Event Summary

### Client-Side Events

| Event Name | Location | Description |
|------------|----------|-------------|
| `user_logged_in` | `home.tsx` | Fired when user successfully logs in (includes user identification) |
| `user_logged_out` | `Header.tsx` | Fired when user logs out |
| Error exceptions | `root.tsx` (ErrorBoundary) | Captures unhandled React errors |
| Error exceptions | `profile.tsx` | Test error tracking feature |

### Server-Side Events

| Event Name | Location | Description |
|------------|----------|-------------|
| `server_login` | `api.auth.login.ts` | Fired when login API is called successfully |
| `burrito_considered` | `api.burrito.consider.ts` | Fired when burrito consideration API is called |

---

## Architecture Notes

### Client-Side Pattern
- PostHog is initialized once on the client
- `PostHogProvider` makes PostHog available via `usePostHog()` hook
- User identification happens only on the client (correct pattern)
- Events are captured using the client-side SDK

### Server-Side Pattern
- A new PostHog Node client is created for each request (proper SSR pattern)
- Client is set on request context via middleware
- Events are captured using the server-side SDK
- Client is properly shut down after each request
- Session and user context are passed via headers and used with `withContext()`

### Key Design Decisions
1. **User identification only on client**: This is the correct pattern - `identify()` should only be called on the client side
2. **New client per request**: This ensures proper request isolation in SSR
3. **Context per request**: Each request gets its own PostHog client instance
4. **Header-based context**: Session ID and distinct ID are passed via headers to maintain context between client and server

---

## Integration Checklist

- ✅ Client-side PostHog initialization
- ✅ Server-side PostHog middleware
- ✅ User identification (client-side only)
- ✅ Login/logout event tracking
- ✅ Error tracking (ErrorBoundary)
- ✅ Server-side event tracking (API routes)
- ✅ Vite configuration for SSR
- ✅ Proxy configuration for development
- ✅ Proper cleanup (server-side client shutdown)

