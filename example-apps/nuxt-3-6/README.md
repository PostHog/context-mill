# PostHog Nuxt 3.6 example

This is a [Nuxt 3.6](https://nuxt.com) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

Nuxt 3.0 through 3.6 **does not** support the `@posthog/nuxt` package. You must use the `posthog-js` and `posthog-node` packages directly instead. This example also does not cover automatic source map uploads, which are only available through the `@posthog/nuxt` package.

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

Copy `.env.example` to `.env` in the root directory and set your project token:

```bash
NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). Leave `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN` blank until you have a real token. When the token is unset, the app still builds and boots: outside production `nuxt.config.ts` logs a warning naming `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, the client plugin logs an error in development, and PostHog is not initialized.

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
│   └── useAuth.ts            # Authentication composable with session restore
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
│   ├── routes/
│   │   └── burrito-relay/
│   │       └── [...path].ts  # Reverse proxy to PostHog
│   └── utils/
│       ├── posthog.ts        # Shared server-side PostHog client singleton
│       └── users.ts          # In-memory user storage utilities
├── types/
│   └── nuxt-app.d.ts          # TypeScript declarations for PostHog
├── app.vue                    # Root component
└── nuxt.config.ts             # Nuxt configuration
```

## Key Integration Points

### Client-side initialization (`plugins/posthog.client.ts`)

```typescript
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import posthog from 'posthog-js'
import type { PostHog, PostHogInterface } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const rawKey = runtimeConfig.public.posthog?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  if (!publicKey) {
    if (import.meta.env.DEV) {
      console.error(
        'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return { provide: { posthog: undefined as PostHog | undefined } }
  }

  const posthogClient = posthog.init(publicKey, {
    api_host: '/burrito-relay',
    ui_host: String(runtimeConfig.public.posthog.host || '').includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
    defaults: runtimeConfig.public.posthog.posthogDefaults as any,
    tracing_headers: [window.location.hostname],
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

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers when `tracing_headers` is configured in `posthog.init`.

### User identification (`pages/index.vue` and `composables/useAuth.ts`)

Identify the user with their stable user ID on login and when restoring a logged-in session from `localStorage` on page reload, keeping `username` in person properties:

```typescript
const { $posthog: posthog } = useNuxtApp()

const handleSubmit = async () => {
  const trimmedUsername = username.value.trim()
  if (!trimmedUsername || !password.value) return

  const success = await auth.login(trimmedUsername, password.value)
  if (success && auth.user.value?.id) {
    posthog?.identify(auth.user.value.id, { username: auth.user.value.username })
    posthog?.capture('user_logged_in')
  }
}
```

Do not call `identify()` on the server when the client already identifies the user and forwards tracing headers.

### Server-side PostHog singleton (`server/utils/posthog.ts`)

Create one `posthog-node` client per server process and return `null` when the token is unconfigured:

```typescript
import { PostHog } from 'posthog-node'
import { useRuntimeConfig } from '#imports'

let posthogClient: PostHog | null = null
let hasWarnedMissingToken = false

export function useServerPostHog(): PostHog | null {
  const runtimeConfig = useRuntimeConfig()
  const rawKey = runtimeConfig.public.posthog?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  if (!publicKey) {
    if (process.env.NODE_ENV !== 'production' && !hasWarnedMissingToken) {
      hasWarnedMissingToken = true
      console.warn(
        'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(publicKey, {
      host: runtimeConfig.public.posthog?.host || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }

  return posthogClient
}
```

### Server-side API routes (`server/api/auth/login.post.ts`, `server/api/burrito/consider.post.ts`)

Server-side API routes reuse the singleton client and read `x-posthog-session-id` and `x-posthog-distinct-id` from incoming request headers, skipping capture when `distinctId` is absent instead of falling back to `user.id`:

```typescript
import { useServerPostHog } from '~/server/utils/posthog'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const sessionId = getHeader(event, 'x-posthog-session-id')?.trim()
  const distinctId = getHeader(event, 'x-posthog-distinct-id')?.trim()
  const posthog = useServerPostHog()

  if (posthog && distinctId) {
    await posthog.withContext(
      { sessionId: sessionId || undefined, distinctId },
      async () => {
        posthog.capture({
          event: 'server_login',
          distinctId,
          properties: {
            $session_id: sessionId || undefined,
            is_new_user: isNewUser,
            source: 'api',
          },
        })
      },
    )

    await posthog.flush().catch(() => {})
  }
})
```

### Event tracking (`pages/burrito.vue`)

Keep PII such as `username` out of event properties:

```typescript
const { $posthog } = useNuxtApp()

$posthog?.capture('burrito_considered', {
  total_considerations: response.user.burritoConsiderations,
})
```

### Error tracking (`plugins/posthog.client.ts`, `pages/profile.vue`)

Errors are captured on both unhandled Vue component errors and manual error boundaries:

1. **Vue error hook**. The `vue:error` hook in `plugins/posthog.client.ts` automatically captures Vue errors:
```typescript
nuxtApp.hook('vue:error', (error) => {
  posthogClient.captureException(error)
})
```

2. **Manual error capture** in components (`pages/profile.vue`):
```typescript
const triggerTestError = () => {
  try {
    throw new Error('Test error for PostHog error tracking')
  } catch (err) {
    posthog?.captureException(err as Error)
  }
}
```

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
    $posthog: PostHog | undefined
  }
}
```

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. This example sends events to its own domain instead: the server route in `server/routes/burrito-relay/[...path].ts` forwards them to PostHog, and the client sets `api_host` to `/burrito-relay` and `ui_host` to your PostHog app URL so toolbar links still work. The route and `ui_host` follow the region in `NUXT_PUBLIC_POSTHOG_HOST`, so setting it to `https://eu.i.posthog.com` sends events to EU Cloud through `eu.i.posthog.com` and `eu-assets.i.posthog.com`. The proxy path is arbitrary, so pick your own and avoid names like `/posthog` or `/analytics`.

Server routes don't exist with `nuxt generate`, and all PostHog traffic passes through your deployment. If your app can't proxy itself, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which is free for PostHog Cloud users.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Nuxt 3 Documentation](https://nuxt.com/docs)
- [PostHog JavaScript Integration Guide](https://posthog.com/docs/libraries/js)
