# PostHog TanStack Router Example (Code-Based Routing)

This is a React and [TanStack Router](https://tanstack.com/router) example demonstrating PostHog integration with product analytics, session replay, and error tracking. This example uses **code-based routing** where routes are defined programmatically.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification
- **Client-side tracking**: Pure client-side React implementation
- **Reverse proxy**: PostHog ingestion host set through an environment variable, so you can point it at a managed reverse proxy

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). `.env.example` lists the variable names. If the token is missing, the app still builds and runs, and logs a warning in development instead of initializing PostHog.

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
      apiKey={posthogToken}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        defaults: '2026-08-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {/* your app */}
    </PostHogProvider>
  )
}
```

`posthogToken` is `import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`. When it is missing, the root route logs a warning in development and renders the app without the provider.

### Reverse proxy

Ad blockers drop events sent to PostHog's domain. A reverse proxy sends them through your own domain instead. This example is a client-only app with no server layer, so it has no proxy code and sends events straight to PostHog (`https://us.i.posthog.com` by default). A Vite dev server proxy would only work in development, not in a production build.

To use a proxy, set up the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) and set `VITE_PUBLIC_POSTHOG_HOST` to your proxy domain. Add `ui_host` for your region (`https://us.posthog.com` or `https://eu.posthog.com`) to the `posthog.init` options so toolbar links keep pointing at PostHog's own domain, not the proxy. For an EU project, also set the default `api_host` to `https://eu.i.posthog.com`.

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
5. **Reverse proxy**: No proxy code, because the app has no server layer; see the reverse proxy section
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
