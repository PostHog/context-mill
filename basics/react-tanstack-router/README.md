# PostHog TanStack Router Example

This is a React and [TanStack Router](https://tanstack.com/router) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

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
│   └── Header.tsx         # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx    # Authentication context with PostHog integration
├── routes/
│   ├── __root.tsx         # Root layout with PostHogProvider
│   ├── index.tsx          # Home/Login page
│   ├── burrito.tsx        # Demo feature page with event tracking
│   └── profile.tsx        # User profile with error tracking demo
├── main.tsx               # App entry point
└── styles.css             # Global styles
```

## Key integration points

### PostHog provider setup (routes/__root.tsx)

PostHog is initialized using `PostHogProvider` from `@posthog/react`. The provider wraps the entire app and handles calling `posthog.init()` automatically:

```typescript
import { PostHogProvider } from '@posthog/react'

export const Route = createRootRoute({
  component: () => (
    <PostHogProvider
      apiKey={import.meta.env.VITE_POSTHOG_KEY!}
      options={{
        api_host: '/ingest',
        ui_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com',
        defaults: '2025-11-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {/* your app */}
    </PostHogProvider>
  ),
})
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
  total_considerations: count,
  username: username,
})
```

### Error tracking (routes/profile.tsx)

```typescript
posthog.captureException(error)
```


## TanStack Router details

This example uses TanStack Router. Key details:

1. **Client-side only**: No server-side logic, no API routes, no posthog-node
2. **File-based routing**: Routes are files in `src/routes` directory
3. **Standard hooks**: Uses `useNavigate()` from @tanstack/react-router
4. **Vite proxy**: Uses Vite's proxy config for PostHog calls
5. **Environment variables**: Uses `import.meta.env.VITE_*`
6. **PostHog provider**: Uses `PostHogProvider` from `@posthog/react` in root route

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [TanStack Router Documentation](https://tanstack.com/router)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
