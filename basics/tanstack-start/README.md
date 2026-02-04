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
VITE_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
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
├── utils/
│   └── posthog-server.ts   # Server-side PostHog client
├── routes/
│   ├── __root.tsx           # Root route with PostHogProvider
│   ├── index.tsx            # Home/login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   └── api/
│       ├── auth/
│       │   └── login.ts     # Login API with server-side tracking
│       └── burrito/
│           └── consider.ts  # Burrito API with server-side tracking
└── styles.css               # Global styles

vite.config.ts               # Vite config with PostHog proxy
.env                         # Environment variables
```

## Key integration points

### Client-side initialization (routes/__root.tsx)

PostHog is initialized using `PostHogProvider` from `@posthog/react`. The provider wraps the entire app in the root shell component and handles calling `posthog.init()` automatically:

```typescript
import { PostHogProvider } from '@posthog/react'

<PostHogProvider
  apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY!}
  options={{
    api_host: '/ingest',
    ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com',
    defaults: '2025-05-24',
    capture_exceptions: true,
    debug: import.meta.env.DEV,
  }}
>
  {children}
</PostHogProvider>
```

### Server-side setup (utils/posthog-server.ts)

For server-side tracking, we use the `posthog-node` SDK with a singleton pattern:

```typescript
import { PostHog } from 'posthog-node'

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.VITE_PUBLIC_POSTHOG_KEY || import.meta.env.VITE_PUBLIC_POSTHOG_KEY!,
      {
        host: process.env.VITE_PUBLIC_POSTHOG_HOST || import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
      }
    )
  }
  return posthogClient
}
```

This client is used in API routes to track server-side events.

### Server-side capture (routes/api/*)

```typescript
import { getPostHogClient } from '../../utils/posthog-server'

const posthog = getPostHogClient()
posthog.capture({
  distinctId: username,
  event: 'server_login',
  properties: {
    username: username,
    source: 'api',
  },
})
```

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

### User identification (contexts/AuthContext.tsx)

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog.identify(username, {
  username: username,
})
```

### Event tracking (routes/burrito.tsx)

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog.capture('burrito_considered', {
  total_considerations: user.burritoConsiderations + 1,
  username: user.username,
})
```

### Error tracking (routes/profile.tsx)

```typescript
posthog.captureException(error)
```

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [TanStack Start documentation](https://tanstack.com/start)
- [TanStack Router documentation](https://tanstack.com/router)
- [PostHog React integration](https://posthog.com/docs/libraries/react)
- [PostHog Node.js integration](https://posthog.com/docs/libraries/node)
