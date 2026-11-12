# SvelteKit PostHog example

This example demonstrates how to integrate PostHog with a SvelteKit application, including:

- Client-side PostHog initialization using SvelteKit hooks
- Server-side PostHog tracking with the Node.js SDK
- Reverse proxy to avoid ad blockers
- User identification and event tracking
- Error tracking with `captureException`
- Session replay configuration

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example environment file and add your PostHog credentials:

```bash
cp .env.example .env
```

Edit `.env` with your PostHog project token:

```
PUBLIC_POSTHOG_PROJECT_TOKEN=your_posthog_project_token_here
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

You can find your project token in your [PostHog project settings](https://app.posthog.com/project/settings). If the token is missing, the app still builds and runs, and logs a warning in development instead of initializing PostHog.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to view the app.

## Project structure

```
src/
├── lib/
│   ├── auth.svelte.ts              # Auth context with Svelte 5 runes
│   ├── components/
│   │   └── Header.svelte           # Navigation component
│   └── server/
│       └── posthog.ts              # Server-side PostHog singleton
├── routes/
│   ├── +layout.svelte              # Root layout with auth provider
│   ├── +page.svelte                # Home/login page
│   ├── burrito/
│   │   └── +page.svelte            # Event tracking demo
│   ├── profile/
│   │   └── +page.svelte            # Error tracking demo
│   └── api/
│       └── auth/
│           └── login/
│               └── +server.ts      # Login API with server-side tracking
├── hooks.client.ts                 # Client-side PostHog init + error handling
├── hooks.server.ts                 # Server hooks with reverse proxy
├── app.css                         # Global styles
└── app.html                        # HTML template
```

## Key integration points

### Client-side initialization (`src/hooks.client.ts`)

PostHog is initialized in the SvelteKit client hooks `init` function, which runs once when the app starts:

```typescript
import posthog from 'posthog-js';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

export async function init() {
  const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    if (dev) {
      console.warn('PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.');
    }
    return;
  }

  posthog.init(token, {
    api_host: '/ingest',
    ui_host: env.PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
    defaults: '2026-08-30',
    capture_exceptions: true
  });
}
```

### Server-side tracking (`src/lib/server/posthog.ts`)

A singleton pattern ensures one PostHog client instance for server-side tracking:

```typescript
import { PostHog } from 'posthog-node';
import { env } from '$env/dynamic/public';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    return null;
  }
  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: env.PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0
    });
  }
  return posthogClient;
}
```

### Reverse proxy (`src/hooks.server.ts`)

Ad blockers drop events sent to PostHog's domain. The server hook in this example sends them through your own domain instead. It forwards `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to PostHog's ingestion host. It also sets the `host` header, forwards the client IP for geolocation, and removes cookies and non-PostHog credentials from the forwarded request. `src/hooks.client.ts` sets `api_host: '/ingest'` so the SDK uses that path, and `ui_host` keeps toolbar links pointing at PostHog.

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/ingest')) {
    // Proxy to PostHog...
  }
  return resolve(event);
};
```

The proxy follows the region in `PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. It derives the ingestion host, the assets host (`-assets.i.posthog.com`), and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value, so an EU project only needs to set `PUBLIC_POSTHOG_HOST`. Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`.

The hook only runs with server-side rendering. If you deploy with `adapter-static`, use the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) instead.

### User identification

When a user logs in, they are identified in PostHog:

```typescript
import posthog from 'posthog-js';

// On login
posthog.identify(userId, { username });
posthog.capture('user_logged_in', { username });

// On logout
posthog.capture('user_logged_out');
posthog.reset();
```

### Error tracking

Errors are automatically captured via the `handleError` hook:

```typescript
export const handleError: HandleClientError = async ({ error }) => {
  posthog.captureException(error);
  return { message: 'An error occurred' };
};
```

You can also manually capture errors:

```typescript
try {
  // Some operation
} catch (err) {
  posthog.captureException(err);
}
```

### Session replay configuration

For session replay to work correctly, add this to `svelte.config.js`:

```javascript
export default {
  kit: {
    paths: {
      relative: false
    }
  }
};
```

## Features demonstrated

1. **Login page** (`/`) - User authentication with PostHog identification
2. **Burrito page** (`/burrito`) - Custom event tracking with properties
3. **Profile page** (`/profile`) - Error tracking demonstration

## Learn more

- [PostHog Svelte documentation](https://posthog.com/docs/libraries/svelte)
- [PostHog SvelteKit proxy setup](https://posthog.com/docs/advanced/proxy/sveltekit)
- [SvelteKit documentation](https://svelte.dev/docs/kit)
