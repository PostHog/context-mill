# PostHog TanStack Start example

This is a [TanStack Start](https://tanstack.com/start) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors automatically
- **User authentication**: Demo login system with PostHog user identification
- **Server-side & client-side tracking**: Complete examples of both tracking methods
- **Reverse proxy**: PostHog ingestion through Vite dev server proxy

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
VITE_POSTHOG_KEY=your_posthog_project_api_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

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
├── lib/
│   ├── posthog-client.ts    # Client-side PostHog initialization
│   └── posthog-server.ts    # Server-side PostHog client
├── routes/
│   ├── __root.tsx           # Root route with AuthProvider
│   ├── index.tsx            # Home/login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   ├── api/
│   │   └── auth/
│   │       └── login.ts     # Login API with server-side tracking
│   └── _demo/               # TanStack Start demo examples
└── styles.css               # Global styles

vite.config.ts               # Vite config with PostHog proxy
.env                         # Environment variables
```

## Key integration points

### Client-side initialization

PostHog is initialized on the client side in `lib/posthog-client.ts`:

```typescript
import posthog from 'posthog-js'

export function initPostHog() {
  if (typeof window !== 'undefined') {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY!, {
      api_host: '/ingest',
      ui_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com',
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug: import.meta.env.DEV,
      loaded: (posthog) => {
        if (import.meta.env.DEV) posthog.debug()
      },
    })
  }
}
```

The initialization happens in the root route's `useEffect` hook to ensure it runs only in the browser.

### Server-side setup

For server-side tracking, we use the `posthog-node` SDK with a singleton pattern:

```typescript
import { PostHog } from 'posthog-node'

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.VITE_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY!,
      {
        host: process.env.VITE_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST,
        flushAt: 1,        // Send immediately
        flushInterval: 0   // No batching delay
      }
    )
  }
  return posthogClient
}
```

This client is used in API routes to track server-side events.

### Reverse proxy configuration

The Vite dev server is configured to proxy PostHog requests to avoid CORS issues and improve reliability:

```typescript
server: {
  proxy: {
    '/ingest': {
      target: 'https://us.i.posthog.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/ingest/, ''),
      secure: false,
    },
  },
}
```

This setup:
- Avoids CORS issues
- Bypasses ad blockers that might block PostHog
- Improves data collection reliability
- Keeps all requests on the same domain

### Authentication flow

1. User enters credentials on home page (`/`)
2. Form submits to `/api/auth/login` API route
3. Server captures `server_login` event with PostHog
4. Client identifies user and captures `user_logged_in` event
5. User is redirected to authenticated pages

### User identification

```typescript
// User identification on login
posthog.identify(username, {
  username: username,
})
```

### Event tracking

```typescript
// Custom event tracking
posthog.capture('burrito_considered', {
  total_considerations: user.burritoConsiderations + 1,
  username: user.username,
})
```

### Error tracking
```typescript
// Error tracking
posthog.captureException(error)
```

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [TanStack Start documentation](https://tanstack.com/start)
- [TanStack Router documentation](https://tanstack.com/router)
- [PostHog React integration](https://posthog.com/docs/libraries/react)
- [PostHog Node.js integration](https://posthog.com/docs/libraries/node)
