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

Edit `.env` with your PostHog project API key:

```
PUBLIC_POSTHOG_KEY=your_posthog_project_api_key_here
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

You can find your API key in your [PostHog project settings](https://app.posthog.com/project/settings).

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

export async function init() {
  posthog.init(PUBLIC_POSTHOG_KEY, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2025-11-30',
    capture_exceptions: true
  });
}
```

### Server-side tracking (`src/lib/server/posthog.ts`)

A singleton pattern ensures one PostHog client instance for server-side tracking:

```typescript
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(PUBLIC_POSTHOG_KEY, {
      host: PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0
    });
  }
  return posthogClient;
}
```

### Reverse proxy (`src/hooks.server.ts`)

The server hooks handle proxies requests through `/ingest` to avoid ad blockers:

```typescript
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/ingest')) {
    const pathname = event.url.pathname.replace('/ingest', '');
    const host = pathname.startsWith('/static')
      ? 'https://us-assets.i.posthog.com'
      : 'https://us.i.posthog.com';
    // Proxy to PostHog...
  }
  return resolve(event);
};
```

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
