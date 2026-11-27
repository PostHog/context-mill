# PostHog Nuxt 4 example

This is a [Nuxt 4](https://nuxt.com) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

Nuxt 4 supports the `@posthog/nuxt` package, which provides automatic PostHog integration with built-in error tracking, source map uploads, and simplified configuration. This is the recommended approach for Nuxt 4+.

For Nuxt 3.0 through 3.6, you must use the `posthog-js` and `posthog-node` packages directly instead. See the [Nuxt 3.6 example](../nuxt-3-6) for that approach.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Automatic error capture on both client and server
- **Source Maps**: Automatic source map uploads when *building for production*
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **SSR Support**: Server-side rendering with Nuxt 4

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

# Optional: only needed to upload source maps
PROJECT_ID=
PERSONAL_API_KEY=
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). Leave `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN` blank until you have a real token. When the token is unset, the app still builds and boots: outside production `nuxt.config.ts` logs a warning naming `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, the client plugin logs an error in development, and `@posthog/nuxt` and the server client stay uninitialized.

For source map uploads, set both `PROJECT_ID` from [PostHog environment variables](https://app.posthog.com/settings/environment#variables) and `PERSONAL_API_KEY` from [PostHog user API keys](https://app.posthog.com/settings/user-api-keys) (requires `organization:read` and `error_tracking:write` scopes).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project Structure

```
├── app/
│   ├── components/
│   │   └── AppHeader.vue        # Navigation header with auth state
│   ├── composables/
│   │   ├── useAuth.ts           # Authentication composable with session restore
│   │   └── usePostHog.ts        # Safe fallback composable when token is unset
│   ├── middleware/
│   │   └── auth.ts              # Authentication middleware
│   ├── pages/
│   │   ├── index.vue            # Home/Login page
│   │   ├── burrito.vue          # Demo feature page with event tracking
│   │   └── profile.vue          # User profile with error tracking demo
│   ├── plugins/
│   │   └── posthog-check.client.ts # Dev browser console check for missing token
│   ├── utils/
│   │   └── formValidation.ts    # Form validation utilities
│   └── app.vue                  # Root component
├── assets/
│   └── css/
│       └── main.css             # Global styles
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.post.ts    # Login API with server-side tracking
│   │   └── burrito/
│   │       └── consider.post.ts # Burrito consideration API with server-side tracking
│   ├── routes/
│   │   └── burrito-relay/
│   │       └── [...path].ts     # Reverse proxy to PostHog
│   └── utils/
│       ├── posthog.ts           # Server-side PostHog utility
│       └── users.ts             # In-memory user storage utilities
├── nuxt.config.ts               # Nuxt configuration with PostHog module
└── package.json
```

## Key Integration Points

### Module Configuration (`nuxt.config.ts`)

Nuxt 4 uses the `@posthog/nuxt` module for automatic PostHog integration when `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is configured, without empty-string token fallbacks:

```typescript
const rawPosthogToken = process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogToken = rawPosthogToken?.trim() ? rawPosthogToken.trim() : undefined
const posthogHost = process.env.NUXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
const rawProjectId = process.env.PROJECT_ID
const posthogProjectId = rawProjectId?.trim() ? rawProjectId.trim() : undefined
const rawPersonalApiKey = process.env.PERSONAL_API_KEY
const posthogPersonalApiKey = rawPersonalApiKey?.trim() ? rawPersonalApiKey.trim() : undefined

export default defineNuxtConfig({
  modules: posthogToken ? ['@posthog/nuxt'] : [],
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: posthogToken,
        host: posthogHost,
      },
    },
  },
  ...(posthogToken
    ? {
        posthogConfig: {
          publicKey: posthogToken,
          host: posthogHost,
          clientConfig: {
            api_host: '/burrito-relay',
            ui_host: posthogHost.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
            defaults: '2026-08-30',
            capture_exceptions: true,
            tracing_headers: ['localhost', 'yourdomain.com'],
          },
          serverConfig: {
            enableExceptionAutocapture: true,
          },
          ...(posthogPersonalApiKey && posthogProjectId
            ? {
                sourcemaps: {
                  enabled: true,
                  projectId: posthogProjectId,
                  personalApiKey: posthogPersonalApiKey,
                  releaseName: 'my-application',
                  releaseVersion: '1.0.0',
                },
              }
            : {}),
        },
      }
    : {}),
})
```

**Key Points:**
- **Conditional initialization**. `@posthog/nuxt` only loads when `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is set, never passing `publicKey: ''`.
- **Error tracking**. Client-side capture uses `capture_exceptions: true`, and server-side capture uses `enableExceptionAutocapture: true`.
- **Source maps**. Source map uploads only enable when both `PERSONAL_API_KEY` and `PROJECT_ID` are set.
- **Session linking**. The `tracing_headers` option automatically adds `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers to requests.

### User identification (`app/pages/index.vue` and `app/composables/useAuth.ts`)

Identify the user with their stable user ID on login and when restoring a persisted session from `localStorage` on page reload, keeping `username` in person properties:

```typescript
const posthog = usePostHog()

const handleSubmit = async () => {
  const trimmedUsername = formData.username.trim()
  if (!trimmedUsername || !formData.password) return

  const success = await auth.login(trimmedUsername, formData.password)
  if (success && auth.user.value?.id) {
    posthog?.identify(auth.user.value.id, { username: auth.user.value.username })
    posthog?.capture('user_logged_in')
  }
}
```

Do not call `identify()` on the server when the client already identifies the user and forwards tracing headers.

### Server-side PostHog utility (`server/utils/posthog.ts`)

The server utility provides a shared `PostHog` client instance when configured and returns `null` when `NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN` is missing:

```typescript
import { PostHog } from 'posthog-node'

let client: PostHog | null = null
let hasWarnedMissingToken = false

export function useServerPostHog(): PostHog | null {
  const config = useRuntimeConfig()
  const posthogConfig = config.public.posthog
  const rawKey = posthogConfig?.publicKey
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

  if (!client) {
    client = new PostHog(publicKey, {
      host: posthogConfig?.host || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }
  return client
}
```

### Server-side API routes (`server/api/auth/login.post.ts`, `server/api/burrito/consider.post.ts`)

Server-side API routes read `x-posthog-session-id` and `x-posthog-distinct-id` from incoming headers, skip capture when `distinctId` is missing instead of falling back to `user.id`, keep PII out of event properties, and await `flush().catch(() => {})`:

```typescript
import { useServerPostHog } from '../../utils/posthog'
import { getOrCreateUser, users } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const trimmedUsername = typeof body?.username === 'string' ? body.username.trim() : ''

  if (!trimmedUsername || !body?.password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password required',
    })
  }

  const isNewUser = !users.has(trimmedUsername)
  const user = getOrCreateUser(trimmedUsername)

  const sessionId = getHeader(event, 'x-posthog-session-id')?.trim()
  const distinctId = getHeader(event, 'x-posthog-distinct-id')?.trim()
  const posthog = useServerPostHog()

  if (posthog && distinctId) {
    posthog.capture({
      distinctId,
      event: 'server_login',
      properties: {
        $session_id: sessionId || undefined,
        isNewUser,
        source: 'api',
      },
    })

    await posthog.flush().catch(() => {})
  }

  return {
    success: true,
    user,
  }
})
```

### Event tracking (`app/pages/burrito.vue`)

The burrito consideration page demonstrates both client-side and server-side event tracking without PII in event properties:

```typescript
const posthog = usePostHog()

const handleConsideration = async () => {
  if (!user.value) return

  const response = await $fetch('/api/burrito/consider', {
    method: 'POST',
    body: { username: user.value.username },
  })

  if (response.success && response.user) {
    auth.setUser(response.user)
    hasConsidered.value = true

    posthog?.capture('burrito_considered', {
      total_considerations: response.user.burritoConsiderations,
    })
  }
}
```

### Error tracking

Errors are captured automatically in multiple ways:

1. **Automatic client-side capture**. The `@posthog/nuxt` module automatically captures Vue errors when `capture_exceptions: true` is set in `posthogConfig.clientConfig`.
2. **Automatic server-side capture**. The module automatically captures Nitro errors when `enableExceptionAutocapture: true` is set in `posthogConfig.serverConfig`.
3. **Manual error capture** in components (`app/pages/profile.vue`):
```typescript
const posthog = usePostHog()

const triggerTestError = () => {
  try {
    throw new Error('Test error for PostHog error tracking')
  } catch (err) {
    posthog?.captureException(err)
  }
}
```

### Accessing PostHog in components

PostHog is accessed via the `usePostHog()` composable:

```typescript
const posthog = usePostHog()
posthog?.capture('event_name', { property: 'value' })
```

## Differences from Nuxt 3.6

- **Module-based**: Uses `@posthog/nuxt` module instead of manual plugin setup
- **Automatic error tracking**: Built-in error capture on both client and server
- **Source map uploads**: Automatic source map uploads for better error tracking
- **Simplified API**: Uses `usePostHog()` composable instead of `useNuxtApp().$posthog`
- **Automatic imports**: In Nuxt 4 server routes, h3 functions (`defineEventHandler`, `readBody`, `createError`, `getHeader`) are auto-imported

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. This example sends events to its own domain instead: the server route in `server/routes/burrito-relay/[...path].ts` forwards them to PostHog, and the client sets `api_host` to `/burrito-relay` and `ui_host` to your PostHog app URL so toolbar links still work. The route and `ui_host` follow the region in `NUXT_PUBLIC_POSTHOG_HOST`, so setting it to `https://eu.i.posthog.com` sends events to EU Cloud through `eu.i.posthog.com` and `eu-assets.i.posthog.com`. The proxy path is arbitrary, so pick your own and avoid names like `/posthog` or `/analytics`.

Server routes don't exist with `nuxt generate`, and all PostHog traffic passes through your deployment. If your app can't proxy itself, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which is free for PostHog Cloud users.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [PostHog Nuxt Integration Guide](https://posthog.com/docs/libraries/nuxt-js)
- [@posthog/nuxt Package](https://www.npmjs.com/package/@posthog/nuxt)
