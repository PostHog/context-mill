# PostHog Nuxt 4 example

This is a [Nuxt 4](https://nuxt.com) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

Nuxt 4 supports the `@posthog/nuxt` package, which provides automatic PostHog integration with built-in error tracking, source map uploads, and simplified configuration. This is the recommended approach for Nuxt 4+.

For Nuxt 3.0 - 3.6, you must use the `posthog-js` and `posthog-node` packages directly instead. See the [Nuxt 3.6 example](../nuxt-3.6) for that approach.

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

Create a `.env` file in the root directory:

```bash
NUXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NUXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional: For source map uploads
PROJECT_ID=your_project_id
PERSONAL_API_KEY=your_personal_api_key
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

For source map uploads, get your project ID from [PostHog environment variables](https://app.posthog.com/settings/environment#variables) and your personal API key from [PostHog user API keys](https://app.posthog.com/settings/user-api-keys) (requires `organization:read` and `error_tracking:write` scopes).

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
│   │   └── useAuth.ts           # Authentication composable
│   ├── middleware/
│   │   └── auth.ts              # Authentication middleware
│   ├── pages/
│   │   ├── index.vue            # Home/Login page
│   │   ├── burrito.vue          # Demo feature page with event tracking
│   │   └── profile.vue           # User profile with error tracking demo
│   ├── utils/
│   │   └── formValidation.ts    # Form validation utilities
│   └── app.vue                  # Root component
├── assets/
│   └── css/
│       └── main.css              # Global styles
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.post.ts     # Login API with server-side tracking
│   │   └── burrito/
│   │       └── consider.post.ts  # Burrito consideration API with server-side tracking
│   └── utils/
│       ├── posthog.ts            # Server-side PostHog utility
│       └── users.ts              # In-memory user storage utilities
├── nuxt.config.ts               # Nuxt configuration with PostHog module
└── package.json
```

## Key Integration Points

### Module Configuration (nuxt.config.ts)

Nuxt 4 uses the `@posthog/nuxt` module for automatic PostHog integration:

```typescript
export default defineNuxtConfig({
  modules: ['@posthog/nuxt'],
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
        host: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      },
    },
  },
  posthogConfig: {
    publicKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
    host: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    clientConfig: {
      capture_exceptions: true, // Enables automatic exception capture on the client side (Vue)
      __add_tracing_headers: ['localhost', 'yourdomain.com'], // Add your domain here
    },
    serverConfig: {
      enableExceptionAutocapture: true, // Enables automatic exception capture on the server side (Nitro)
    },
    sourcemaps: {
      enabled: true,
      envId: process.env.PROJECT_ID || '',
      personalApiKey: process.env.PERSONAL_API_KEY || '',
      project: 'my-application',
      version: '1.0.0',
    },
  },
})
```

**Key Points:**
- The `@posthog/nuxt` module handles PostHog initialization automatically
- Client-side error tracking is enabled via `capture_exceptions: true`
- Server-side error tracking is enabled via `enableExceptionAutocapture: true`
- Source map uploads are configured for better error tracking
- The `__add_tracing_headers` option automatically adds `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers to requests

**Important**: do not identify users on the server-side.

### User identification (app/pages/index.vue)

The user is identified when the user logs in on the **client-side**.

```typescript
const posthog = usePostHog()

const handleSubmit = async () => {
  const success = await auth.login(formData.username, formData.password)
  if (success) {
    // Identifying the user once on login/sign up is enough.
    posthog?.identify(formData.username)
    
    // Capture login event
    posthog?.capture('user_logged_in')
  }
}
```

The session and distinct ID are automatically passed to the backend via the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers because we set the `__add_tracing_headers` option in the PostHog configuration.

**Important**: do not identify users on the server-side.

### Server-side API routes (server/api/auth/login.post.ts)

Server-side API routes use the `useServerPostHog()` utility to get a PostHog Node client and extract session and user context from request headers:

```typescript
import { useServerPostHog } from '../../utils/posthog'
import { getOrCreateUser, users } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const { username, password } = body || {}

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password required',
    })
  }

  const user = getOrCreateUser(username)
  const isNewUser = !users.has(username)

  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  // Capture server-side login event
  const posthog = useServerPostHog()
  
  posthog.capture({
    distinctId: distinctId,
    event: 'server_login',
    properties: {
      $session_id: sessionId,
      username: username,
      isNewUser: isNewUser,
      source: 'api',
    },
  })

  return {
    success: true,
    user,
  }
})
```

**Key Points:**
- Uses `useServerPostHog()` utility to get a shared PostHog Node client instance
- Extracts `sessionId` and `distinctId` from request headers using `getHeader()` (auto-imported from h3)
- The PostHog client is reused across requests (singleton pattern)
- h3 functions like `defineEventHandler`, `readBody`, `createError`, `getHeader` are auto-imported in server routes

### Event tracking (app/pages/burrito.vue)

The burrito consideration page demonstrates both client-side and server-side event tracking:

```typescript
const posthog = usePostHog()

const handleConsideration = async () => {
  if (!user.value) return

  try {
    // Call server-side API route
    const response = await $fetch('/api/burrito/consider', {
      method: 'POST',
      body: { username: user.value.username },
    })

    if (response.success && response.user) {
      auth.setUser(response.user)
      hasConsidered.value = true

      // Client-side tracking (in addition to server-side tracking)
      posthog?.capture('burrito_considered', {
        total_considerations: response.user.burritoConsiderations,
        username: response.user.username,
      })

      setTimeout(() => {
        hasConsidered.value = false
      }, 2000)
    }
  } catch (err) {
    console.error('Error considering burrito:', err)
  }
}
```

The server-side route (`server/api/burrito/consider.post.ts`) also captures the event, demonstrating dual tracking.

### Error tracking

Errors are captured automatically in multiple ways:

1. **Automatic client-side capture** - The `@posthog/nuxt` module automatically captures Vue errors when `capture_exceptions: true` is set in `posthogConfig.clientConfig`.

2. **Automatic server-side capture** - The module automatically captures Nitro errors when `enableExceptionAutocapture: true` is set in `posthogConfig.serverConfig`.

3. **Manual error capture** in components (app/pages/profile.vue):
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

### Server-side tracking (server/api/auth/login.post.ts)

Server-side events use the shared PostHog Node client. Note that h3 functions are auto-imported in Nuxt server routes:

```typescript
import { useServerPostHog } from '../../utils/posthog'
import { getOrCreateUser, users } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const { username, password } = body || {}

  // ... validation logic ...

  // Extract headers using getHeader (auto-imported from h3)
  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  // Capture server-side event
  const posthog = useServerPostHog()
  
  posthog.capture({
    distinctId: distinctId,
    event: 'server_login',
    properties: {
      $session_id: sessionId,
      username: username,
      isNewUser: isNewUser,
      source: 'api',
    },
  })

  return { success: true, user }
})
```

**Key Points:**
- The PostHog Node client is shared across requests via `useServerPostHog()` utility
- `getHeader()` is auto-imported from h3 in Nuxt server routes (no need to import from 'h3')
- h3 functions like `defineEventHandler`, `readBody`, `createError` are also auto-imported
- The `distinctId` and `sessionId` are extracted from request headers and used to maintain context between client and server
- No need to manually shutdown the client (it's managed by the module)

### Accessing PostHog in components

PostHog is accessed via the `usePostHog()` composable provided by `@posthog/nuxt`:

```typescript
const posthog = usePostHog()
posthog?.capture('event_name', { property: 'value' })
```

The composable is automatically typed and available throughout your Nuxt application.

### Server-side PostHog utility (server/utils/posthog.ts)

The server utility provides a shared PostHog Node client instance:

```typescript
import { PostHog } from 'posthog-node'

let client: PostHog | null = null

export function useServerPostHog(): PostHog {
  if (!client) {
    const config = useRuntimeConfig()
    const posthogConfig = config.public.posthog
    client = new PostHog(posthogConfig.publicKey, {
      host: posthogConfig.host,
    })
  }
  return client
}
```

This ensures a single PostHog client instance is reused across all server requests, improving performance.

## Differences from Nuxt 3.6

- **Module-based**: Uses `@posthog/nuxt` module instead of manual plugin setup
- **Automatic error tracking**: Built-in error capture on both client and server
- **Source map uploads**: Automatic source map uploads for better error tracking
- **Simplified API**: Uses `usePostHog()` composable instead of `useNuxtApp().$posthog`
- **Shared server client**: Reuses PostHog Node client across requests instead of creating per-request
- **Automatic imports**: In Nuxt 4 server routes, h3 functions (`defineEventHandler`, `readBody`, `createError`, `getHeader`, etc.) are auto-imported - no need to import them explicitly

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Nuxt 4 Documentation](https://nuxt.com/docs)
- [PostHog Nuxt Integration Guide](https://posthog.com/docs/libraries/nuxt-js)
- [@posthog/nuxt Package](https://www.npmjs.com/package/@posthog/nuxt)
