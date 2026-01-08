# PostHog React Router 7 Data Mode example

This is a [React Router 7](https://reactrouter.com) Data Mode example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Client-side Tracking**: Examples of client-side tracking methods
- **Data Mode**: React Router 7 data mode with client-side routing

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
VITE_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the app.

## Project Structure

```
app/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── routes/
│   ├── home.tsx             # Home/Login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   └── profile.tsx          # User profile with error tracking demo
├── root.tsx                 # Root route with error boundary
└── routes.tsx               # Route configuration

index.tsx                    # App entry point with PostHog initialization
```

## Key Integration Points

### Client-side initialization (index.tsx)

```typescript
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
});

<PostHogProvider client={posthog}>
  <RouterProvider router={router} />
</PostHogProvider>
```

### User identification (AuthContext.tsx)

The user is identified when the user logs in on the **client-side**.

```typescript
posthog.identify(username);
posthog.capture('user_logged_in');
```

The session and distinct ID can be passed to the backend by including the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers.

You should use these headers in the backend to identify events. 

**Important**: do not identify users on the server-side.

### Event tracking (burrito.tsx)

```typescript
posthog?.capture('burrito_considered', {
  total_considerations: updatedUser.burritoConsiderations,
  username: user.username,
});
```

### Error tracking (root.tsx, profile.tsx)

Errors are captured in two ways:

1. **Error boundary** - The `RootErrorBoundary` in `root.tsx` automatically captures unhandled React Router errors:
```typescript
export function RootErrorBoundary() {
  const error = useRouteError();
  const posthog = usePostHog();
  if (error) {
    posthog.captureException(error);
  }
  // ... error UI
}
```

2. **Manual error capture** in components (profile.tsx):
```typescript
posthog?.captureException(err);
```

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 7 Documentation](https://reactrouter.com)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
