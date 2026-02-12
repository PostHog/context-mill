# PostHog TanStack Router Example (Code-Based Routing)

This is a React and [TanStack Router](https://tanstack.com/router) example demonstrating PostHog integration with product analytics, session replay, and error tracking. This example uses **code-based routing** where routes are defined programmatically.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification
- **Client-side tracking**: Pure client-side React implementation
- **Reverse proxy**: PostHog ingestion through Vite proxy

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
├── contexts/
│   └── AuthContext.tsx    # Authentication context with PostHog integration
├── main.tsx               # App entry point with all routes defined in code
├── reportWebVitals.ts     # Performance monitoring
└── styles.css             # Global styles
```

## Key integration points

### PostHog provider setup (main.tsx)

PostHog is initialized using `PostHogProvider` from `@posthog/react`. The provider wraps the entire app in the root route component:

```typescript
import { PostHogProvider } from '@posthog/react'
import { createRootRoute } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY!}
      options={{
        api_host: '/ingest',
        ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com',
        defaults: '2026-01-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {/* your app */}
    </PostHogProvider>
  )
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

### Event tracking (main.tsx - BurritoPage)

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
})
```

### Error tracking (main.tsx - ProfilePage)

```typescript
posthog.captureException(error)
```

## TanStack Router details

This example uses TanStack Router with **code-based routing**. Key details:

1. **Client-side only**: No server-side logic, no API routes, no posthog-node
2. **Code-based routing**: All routes defined in `main.tsx` using `createRoute()` and `createRootRoute()`
3. **Manual route tree**: Routes connected with `addChildren()` method
4. **Standard hooks**: Uses `useNavigate()` from @tanstack/react-router
5. **Vite proxy**: Uses Vite's proxy config for PostHog calls
6. **Environment variables**: Uses `import.meta.env.VITE_*`
7. **PostHog provider**: Uses `PostHogProvider` from `@posthog/react` in root route

### Code-based vs File-based routing

This example demonstrates **code-based routing**, where routes are defined programmatically:

```typescript
import { createRoute, createRootRoute, createRouter } from '@tanstack/react-router'

const rootRoute = createRootRoute({ component: RootComponent })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const burritoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/burrito',
  component: BurritoPage,
})

const routeTree = rootRoute.addChildren([indexRoute, burritoRoute])

const router = createRouter({ routeTree })
```

For file-based routing (auto-generated from file structure), see the `react-tanstack-router-file-based` example.

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [TanStack Router Documentation](https://tanstack.com/router)
- [TanStack Router Code-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/code-based-routing)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
