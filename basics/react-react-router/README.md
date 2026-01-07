# PostHog React Router example

This is a React and [React Router v7](https://reactrouter.com) v7 example demonstrating PostHog integration with product analytics, session replay, and error tracking.

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
# or
pnpm install
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
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the app.

## Project structure

```
src/
├── components/
│   └── Header.tsx         # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx    # Authentication context with PostHog integration
├── lib/
│   └── posthog-client.ts  # Client-side PostHog initialization
├── routes/
│   ├── home.tsx           # Home/Login page
│   ├── burrito.tsx        # Demo feature page with event tracking
│   └── profile.tsx        # User profile with error tracking demo
├── root.tsx               # Root layout with providers
├── routes.ts              # Route configuration
└── globals.css            # Global styles
```

## Key integration points

### Client-side initialization (lib/posthog-client.ts)

```typescript
import posthog from "posthog-js"

posthog.init(import.meta.env.VITE_POSTHOG_KEY!, {
  api_host: import.meta.env.VITE_POSTHOG_HOST,
  ui_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
  defaults: '2025-11-30',
  capture_exceptions: true,
  debug: import.meta.env.DEV,
});
```

### PostHog provider setup (root.tsx)

```typescript
import { PostHogProvider } from 'posthog-js/react'
import posthog from "./lib/posthog-client"

export default function App() {
  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>
        <Header />
        <main><Outlet /></main>
      </AuthProvider>
    </PostHogProvider>
  )
}
```

### User identification (AuthContext.tsx)

```typescript
const posthog = usePostHog()

posthog.identify(username, {
  username: username,
})
```

### Event tracking (routes/burrito.tsx)

```typescript
posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
})
```

### Error tracking (routes/profile.tsx)

```typescript
posthog.captureException(error)
```


## React Router details

This example uses React Router v7. Key details:

1. **Client-side only**: No server-side logic, no API routes, no posthog-node
2. **Route configuration**: Routes defined in `src/routes.ts` config file
3. **Standard hooks**: Uses `useNavigate()` from react-router
4. **Vite proxy**: Uses Vite's proxy config for PostHog calls
5. **Environment variables**: Uses `import.meta.env.VITE_*` 
6. **Meta exports**: Uses `meta` function exports for page metadata
7. **PostHog provider**: Uses `PostHogProvider` wrapper 

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [React Router Documentation](https://reactrouter.com)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
