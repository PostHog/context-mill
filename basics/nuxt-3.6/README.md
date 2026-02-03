# PostHog Nuxt 3.6 example

This is a [Nuxt 3.6](https://nuxt.com) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

Nuxt 3.0 - 3.6 **does not** support the `@posthog/nuxt` package. You must use the `posthog-js` and `posthog-node` packages directly instead. This example also does not cover automatic source map uploads, only available through the `@posthog/nuxt` package.

Nuxt 2.x is also distinctly different, [follow this guide instead](https://posthog.com/docs/libraries/nuxt-js-2).

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **SSR Support**: Server-side rendering with Nuxt 3.6

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
NUXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project Structure

```
├── assets/
│   └── css/
│       └── main.css          # Global styles
├── components/
│   └── Header.vue            # Navigation header with auth state
├── composables/
│   └── useAuth.ts            # Authentication composable
├── pages/
│   ├── index.vue             # Home/Login page
│   ├── burrito.vue           # Demo feature page with event tracking
│   └── profile.vue           # User profile with error tracking demo
├── plugins/
│   └── posthog.client.ts     # Client-side PostHog plugin
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.post.ts # Login API with server-side tracking
│   │   └── burrito/
│   │       └── consider.post.ts # Burrito API with server-side tracking
│   └── utils/
│       └── users.ts          # In-memory user storage utilities
├── types/
│   └── nuxt-app.d.ts          # TypeScript declarations for PostHog
├── app.vue                    # Root component with error handling
└── nuxt.config.ts             # Nuxt configuration
```

## Key Integration Points

### Client-side initialization (plugins/posthog.client.ts)

```typescript
import posthog from 'posthog-js'
import type { PostHog, PostHogInterface } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const posthogClient = posthog.init(runtimeConfig.public.posthog.publicKey, {
    api_host: runtimeConfig.public.posthog.host,
    defaults: runtimeConfig.public.posthog.posthogDefaults as any,
    loaded: (posthog: PostHogInterface) => {
      if (import.meta.env.MODE === 'development') posthog.debug()
    },
  })

  nuxtApp.hook('vue:error', (error) => {
    posthogClient.captureException(error)
  })

  return {
    provide: {
      posthog: posthogClient as PostHog,
    },
  }
})
```

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers when `__add_tracing_headers` is configured in the PostHog initialization.

**Important**: do not identify users on the server-side.

### User identification (pages/index.vue)

The user is identified when the user logs in on the **client-side**.

```typescript
const { $posthog: posthog } = useNuxtApp()

const handleSubmit = async () => {
  const success = await auth.login(username.value, password.value)
  if (success) {
    // Identifying the user once on login/sign up is enough.
    posthog?.identify(username.value)
    
    // Capture login event
    posthog?.capture('user_logged_in')
  }
}
```

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers because we set the `__add_tracing_headers` option in the PostHog initialization.

**Important**: do not identify users on the server-side.

### Server-side API routes (server/api/auth/login.post.ts, server/api/burrito/consider.post.ts)

Server-side API routes create a PostHog Node client for each request and extract session and user context from request headers:

```typescript
import { PostHog } from 'posthog-node'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig()

  // Relies on __add_tracing_headers being set in the client-side SDK
  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  const posthog = new PostHog(
    runtimeConfig.public.posthog.publicKey,
    { 
      host: runtimeConfig.public.posthog.host, 
    }
  )

  await posthog.withContext(
    { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
    async () => {
      posthog.capture({
        event: 'server_login',
        distinctId: distinctId ?? username,
      })
    }
  )

  // Always shutdown to ensure all events are flushed
  await posthog.shutdown()
})
```

**Key Points:**
- Creates a new PostHog Node client for each request
- Extracts `sessionId` and `distinctId` from request headers using `getHeader()` from `h3`
- Uses `withContext()` to associate server-side events with the correct session/user
- Properly shuts down the client after each request to ensure events are flushed

### Event tracking (pages/burrito.vue)

```typescript
const { $posthog: posthog } = useNuxtApp()

const handleConsideration = () => {
  if (user.value) {
    auth.incrementBurritoConsiderations()
    
    posthog?.capture('burrito_considered', {
      total_considerations: user.value?.burritoConsiderations + 1,
      username: user.value?.username,
    })
  }
}
```

### Error tracking (app.vue, plugins/posthog.client.ts, pages/profile.vue)

Errors are captured in three ways:

1. **Vue error hook** - The `vue:error` hook in `plugins/posthog.client.ts` automatically captures Vue errors:
```typescript
nuxtApp.hook('vue:error', (error) => {
  posthogClient.captureException(error)
})
```

2. **Error boundary** - The `onErrorCaptured` in `app.vue` captures component errors:
```typescript
onErrorCaptured((error) => {
  posthog?.captureException(error)
  return false // Let the error propagate
})
```

3. **Manual error capture** in components (pages/profile.vue):
```typescript
const triggerTestError = () => {
  try {
    throw new Error('Test error for PostHog error tracking')
  } catch (err) {
    posthog?.captureException(err as Error)
  }
}
```

### Server-side tracking (server/api/auth/login.post.ts, server/api/burrito/consider.post.ts)

Server-side events use a PostHog Node client created per request:

```typescript
const posthog = new PostHog(
  runtimeConfig.public.posthog.publicKey,
  { 
    host: runtimeConfig.public.posthog.host, 
  }
)

await posthog.withContext(
  { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
  async () => {
    posthog.capture({
      event: 'server_login',
      distinctId: distinctId ?? username,
    })
  }
)

await posthog.shutdown()
```

**Key Points:**
- The PostHog Node client is created per request in each API route
- Events are automatically associated with the correct user/session via `withContext()`
- The `distinctId` and `sessionId` are extracted from request headers and used to maintain context between client and server
- Always call `shutdown()` to ensure events are flushed

### Accessing PostHog in components

PostHog is accessed via `useNuxtApp()`:

```typescript
const { $posthog: posthog } = useNuxtApp()
posthog?.capture('event_name', { property: 'value' })
```

TypeScript types are provided via `types/nuxt-app.d.ts`:

```typescript
import type { PostHog } from 'posthog-js'

declare module '#app' {
  interface NuxtApp {
    $posthog: PostHog
  }
}
```

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [PostHog JavaScript Integration Guide](https://posthog.com/docs/libraries/js)
