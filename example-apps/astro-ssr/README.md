# PostHog Astro SSR Example

This is an [Astro](https://astro.build/) server-side rendered (SSR) example demonstrating PostHog integration with both client-side and server-side event tracking.

It uses:

- **Client-side**: PostHog web snippet for browser analytics
- **Server-side**: `posthog-node` for API route event tracking

This shows how to:

- Initialize PostHog on both client and server
- Track events from API routes using `posthog-node`
- Link client and server sessions automatically with the `tracing_headers` option
- Identify users on login and restore identity across page reloads
- Capture errors via `posthog.captureException()`
- Reset PostHog state on logout

## Features

- **Server-side rendering**: Full SSR with `output: 'server'`
- **API routes**: Server-side endpoints for auth and event tracking
- **Dual tracking**: Events captured on both client and server
- **Session continuity**: Session and distinct ID forwarded automatically via `tracing_headers`
- **Product analytics**: Track login and burrito consideration events
- **Session replay**: Enabled via PostHog snippet configuration
- **Error tracking**: Manual error capture sent to PostHog
- **Simple auth flow**: Demo login using localStorage + server API

## Getting started

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root and set your project tokens:

```bash
# Client-side (PUBLIC_ prefix exposes to browser)
PUBLIC_POSTHOG_PROJECT_TOKEN=
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server-side (no PUBLIC_ prefix, server-only)
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your project settings in PostHog. Leave token variables blank until you have a real token. When a token is unset, the app still builds and runs: in development it logs a message naming the variable and skips PostHog initialization.

### 3. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open `http://localhost:4321` in your browser.

## Project structure

```text
src/
  components/
    posthog.astro      # PostHog snippet for client-side tracking
    Header.astro       # Navigation + logout, calls posthog.reset()
  layouts/
    PostHogLayout.astro # Root layout that includes PostHog + Header
  lib/
    auth.ts            # Client-side auth utilities
    posthog-server.ts  # Server-side PostHog client singleton
  pages/
    index.astro        # Login form, calls /api/auth/login
    burrito.astro      # Burrito demo, calls /api/events/burrito
    profile.astro      # Profile + error tracking demo
    api/
      auth/
        login.ts       # Server-side login endpoint with PostHog tracking
      events/
        burrito.ts     # Server-side event capture endpoint
  styles/
    global.css         # Global styles
```

## Key integration points

### Server-side PostHog client (`src/lib/posthog-server.ts`)

A singleton pattern ensures only one PostHog client is created, returning `null` when `POSTHOG_PROJECT_TOKEN` is unconfigured:

```typescript
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;
let hasWarnedMissingToken = false;

export function getPostHogServer(): PostHog | null {
  const token = import.meta.env.POSTHOG_PROJECT_TOKEN?.trim();
  if (!token) {
    if (!import.meta.env.PROD && !hasWarnedMissingToken) {
      hasWarnedMissingToken = true;
      console.warn(
        "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: import.meta.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    });
  }
  return posthogClient;
}
```

### API route with server-side tracking (`src/pages/api/auth/login.ts`)

```typescript
import { getPostHogServer } from "../../../lib/posthog-server";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const trimmedUsername = typeof body.username === "string" ? body.username.trim() : "";
  if (!trimmedUsername || !body.password) {
    return new Response(JSON.stringify({ error: "Username and password are required" }), { status: 400 });
  }

  const user = users.get(trimmedUsername);
  const clientDistinctId = request.headers.get("X-PostHog-Distinct-Id");
  const sessionId = request.headers.get("X-PostHog-Session-Id");
  const posthog = getPostHogServer();

  if (posthog && user?.id) {
    posthog.withContext(
      {
        distinctId: clientDistinctId || undefined,
        sessionId: sessionId || undefined,
      },
      () => {
        posthog.capture({
          distinctId: user.id,
          event: "server_login",
          properties: {
            $session_id: sessionId || undefined,
            source: "api",
          },
        });
      },
    );

    await posthog.flush().catch(() => {});
  }

  return new Response(JSON.stringify({ success: true, userId: user?.id, username: trimmedUsername }));
};
```

### Passing session context to the server (`src/components/posthog.astro`)

The `tracing_headers` option in `posthog.init` automatically adds the
`X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers to same-origin
`fetch`/`XHR` requests, so the server route above receives them with no manual
wiring:

```javascript
if (apiKey && apiKey.trim()) {
  posthog.init(apiKey, {
    api_host: apiHost || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    tracing_headers: [window.location.hostname],
  });

  const currentUserId = localStorage.getItem("currentUserId");
  const currentUser = localStorage.getItem("currentUser");
  if (currentUserId && currentUser) {
    posthog.identify(currentUserId, { username: currentUser });
  }
}

// Client fetches then need no PostHog headers of their own:
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password }),
});
```

### Client-side identification (`src/pages/index.astro`)

After server login succeeds, identify on the client with the stable user ID and keep `username` in person properties:

```javascript
window.posthog?.identify(data.userId, { username });
window.posthog?.capture("user_logged_in");
```

### Logout and session reset (`src/components/Header.astro`)

When logging out of an authenticated session, capture the logout event before resetting PostHog:

```javascript
if (currentUser) {
  window.posthog?.capture("user_logged_out");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentUserId");
  localStorage.removeItem("burritoConsiderations");
  window.posthog?.reset();
}
```

## Scripts

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. Routing events through your own domain avoids that.

This example does not proxy requests: the Astro docs show no proxy pattern, so the browser sends events straight to `PUBLIC_POSTHOG_HOST`. To use a proxy, point `PUBLIC_POSTHOG_HOST` at a proxy you host and set `ui_host` in `posthog.init` to your PostHog app URL so toolbar links still work. If your app can't proxy requests itself, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which is free for PostHog Cloud users.

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Astro guide](https://posthog.com/docs/libraries/astro)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [Astro SSR documentation](https://docs.astro.build/en/guides/server-side-rendering/)
