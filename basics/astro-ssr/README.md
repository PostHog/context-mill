# PostHog Astro SSR Example

This is an [Astro](https://astro.build/) server-side rendered (SSR) example demonstrating PostHog integration with both client-side and server-side event tracking.

It uses:

- **Client-side**: PostHog web snippet for browser analytics
- **Server-side**: `posthog-node` for API route event tracking

This shows how to:

- Initialize PostHog on both client and server
- Track events from API routes using `posthog-node`
- Pass session IDs from client to server for unified sessions
- Identify users on both client and server
- Capture errors via `posthog.captureException()`
- Reset PostHog state on logout

## Features

- **Server-side rendering**: Full SSR with `output: 'server'`
- **API routes**: Server-side endpoints for auth and event tracking
- **Dual tracking**: Events captured on both client and server
- **Session continuity**: Session ID passed to server via headers
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

Create a `.env` file in the project root:

```bash
# Client-side (PUBLIC_ prefix exposes to browser)
PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Server-side (no PUBLIC_ prefix, server-only)
POSTHOG_API_KEY=your_posthog_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your project settings in PostHog.

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

A singleton pattern ensures only one PostHog client is created:

```typescript
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(import.meta.env.POSTHOG_API_KEY, {
      host: import.meta.env.POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
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
  const { username } = body;

  // Get session ID from client
  const sessionId = request.headers.get("X-PostHog-Session-Id");

  const posthog = getPostHogServer();

  // Capture server-side event
  posthog.capture({
    distinctId: username,
    event: "server_login",
    properties: {
      $session_id: sessionId || undefined,
      source: "api",
    },
  });

  return new Response(JSON.stringify({ success: true }));
};
```

### Passing session ID to server (`src/pages/index.astro`)

```javascript
// Get the session ID from PostHog to pass to the server
const sessionId = window.posthog?.get_session_id?.() || null;

const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-PostHog-Session-Id": sessionId || "",
  },
  body: JSON.stringify({ username, password }),
});
```

### Client-side identification (`src/pages/index.astro`)

After server login succeeds, also identify on client:

```javascript
window.posthog?.identify(username);
window.posthog?.capture("user_logged_in");
```

### Logout and session reset (`src/components/Header.astro`)

On logout, both the local auth state and PostHog state are cleared:

```javascript
window.posthog?.capture("user_logged_out");
localStorage.removeItem("currentUser");
window.posthog?.reset();
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

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Astro guide](https://posthog.com/docs/libraries/astro)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [Astro SSR documentation](https://docs.astro.build/en/guides/server-side-rendering/)
