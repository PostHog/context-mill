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

Copy `.env.example` to `.env` in the root directory and set your project token:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). `.env.example` lists the variable names. If the token is missing, the app still builds and runs, and logs an error in development instead of initializing PostHog.

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

PostHog is initialized using `PostHogProvider` from `@posthog/react`. When `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` is set, the provider wraps the app in the root route component:

```typescript
import { PostHogProvider } from '@posthog/react'
import { createRootRoute } from '@tanstack/react-router'

// Read the project token without a fallback value. When it is missing, render the app
// without PostHogProvider rather than initializing the SDK with a placeholder key.
const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const app = <AuthProvider>{/* your app */}</AuthProvider>

  return posthogToken ? (
    <PostHogProvider
      apiKey={posthogToken}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        defaults: '2026-08-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {app}
    </PostHogProvider>
  ) : (
    app
  )
}
```

When `posthogToken` is missing, the root module logs an error in development and renders the app without `PostHogProvider`.

### Reverse proxy

Ad blockers drop events sent to PostHog's domain. A reverse proxy sends them through your own domain instead. This example is a client-only app with no server layer, so it has no proxy code and sends events straight to PostHog (`https://us.i.posthog.com` by default). A Vite dev server proxy would only work in development, not in a production build.

To use a proxy, set up the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy) and set `VITE_PUBLIC_POSTHOG_HOST` to your proxy domain. Add `ui_host` for your region (`https://us.posthog.com` or `https://eu.posthog.com`) to the `PostHogProvider` options so toolbar links keep pointing at PostHog's own domain, not the proxy. For an EU project, also set `VITE_PUBLIC_POSTHOG_HOST` to `https://eu.i.posthog.com`.

### User identification (contexts/AuthContext.tsx)

Users are identified with a stable UUID (`localUser.id`) on login and when restoring a persisted session from `localStorage` on reload. `username` is sent only as a person property, never as `distinctId` or in `capture()` event properties.

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog?.identify(localUser.id, {
  username: localUser.username,
})

posthog?.capture('user_logged_in', {
  is_new_user: isNewUser,
})
```

On logout from an active session, capture `user_logged_out` before calling `reset()`:

```typescript
if (user) {
  posthog?.capture('user_logged_out')
  posthog?.reset()
}
```

### Event tracking (main.tsx, BurritoPage)

```typescript
import { usePostHog } from '@posthog/react'

const posthog = usePostHog()

posthog?.capture('burrito_considered', {
  total_considerations: user.burritoConsiderations + 1,
})
```

### Error tracking (main.tsx, ProfilePage)

```typescript
posthog?.captureException(err)
```

## TanStack Router details

This example uses TanStack Router with **code-based routing**. Key details:

1. **Client-side only**: No server-side logic, no API routes, no posthog-node
2. **Code-based routing**: All routes defined in `main.tsx` using `createRoute()` and `createRootRoute()`
3. **Manual route tree**: Routes connected with `addChildren()` method
4. **Standard hooks**: Uses `useNavigate()` from `@tanstack/react-router`
5. **Reverse proxy**: No proxy code, because the app has no server layer. See the reverse proxy section
6. **Environment variables**: Uses `import.meta.env.VITE_*`
7. **PostHog provider**: Uses `PostHogProvider` from `@posthog/react` in root route when the project token is configured

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
