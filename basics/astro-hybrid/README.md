# PostHog Astro Hybrid Example

This is an [Astro](https://astro.build/) hybrid rendering example demonstrating PostHog integration with both static and on-demand rendered pages.

Hybrid mode allows you to have most pages prerendered (static) while opting specific pages into server-side rendering (SSR) when needed.

It uses:

- **Client-side**: PostHog web snippet for browser analytics
- **Server-side**: `posthog-node` for API route event tracking

This shows how to:

- Configure Astro for hybrid rendering (static default with per-page SSR opt-in)
- Opt specific pages into SSR with `export const prerender = false`
- Keep most pages static for performance
- Track events from API routes using `posthog-node`
- Pass session IDs from client to server for unified sessions

## Features

- **Hybrid rendering**: Static pages by default, SSR when needed
- **API routes**: Server-side endpoints for auth and event tracking
- **Dual tracking**: Events captured on both client and server
- **Session continuity**: Session ID passed to server via headers
- **Product analytics**: Track login and burrito consideration events
- **Error tracking**: Manual error capture sent to PostHog

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
PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
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
    index.astro        # Static (prerendered) - login form
    burrito.astro      # SSR (prerender=false) - calls API routes
    profile.astro      # Static (prerendered) - user profile
    api/
      auth/
        login.ts       # Server-side login endpoint with PostHog tracking
      events/
        burrito.ts     # Server-side event capture endpoint
  styles/
    global.css         # Global styles
```

## Key integration points

### Hybrid mode configuration (`astro.config.mjs`)

In Astro 5, `output: 'static'` is the default and supports per-page SSR opt-in. You need an adapter for the SSR pages to work:

```javascript
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  // 'static' is the default - pages are prerendered unless they opt out
  output: "static",
  adapter: node({ mode: "standalone" }),
});
```

### Opting a page into SSR (`src/pages/burrito.astro`)

```astro
---
// Opt this page into on-demand rendering (SSR)
// In hybrid mode, pages are static by default
export const prerender = false;
---
```

### Server-side PostHog client (`src/lib/posthog-server.ts`)

A singleton pattern ensures only one PostHog client is created:

```typescript
import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(import.meta.env.PUBLIC_POSTHOG_KEY, {
      host: import.meta.env.PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}
```

### API route with server-side tracking (`src/pages/api/events/burrito.ts`)

```typescript
import { getPostHogServer } from "../../../lib/posthog-server";

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const sessionId = request.headers.get("X-PostHog-Session-Id");

  const posthog = getPostHogServer();
  posthog.capture({
    distinctId: body.username,
    event: "burrito_considered",
    properties: {
      $session_id: sessionId || undefined,
      source: "api",
    },
  });

  return new Response(JSON.stringify({ success: true }));
};
```

## When to use Hybrid mode

Use hybrid mode when you want:

- **Performance**: Most pages prerendered as static HTML
- **Flexibility**: Some pages need server-side logic (auth, personalization)
- **API routes**: Server-side endpoints for data processing

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
- [Astro Hybrid Rendering](https://docs.astro.build/en/guides/on-demand-rendering/)
