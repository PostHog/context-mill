# PostHog React Router 7 Declarative example

This is a [React Router 7](https://reactrouter.com) Declarative example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Client-side Tracking**: Examples of client-side tracking methods
- **Declarative Routing**: React Router 7 declarative routing configuration

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
src/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── routes/
│   ├── Root.tsx             # Root route component
│   ├── Home.tsx             # Home/Login page
│   ├── Burrito.tsx          # Demo feature page with event tracking
│   └── Profile.tsx          # User profile with error tracking demo
├── main.tsx                 # App entry point with PostHog initialization
└── globals.css              # Global styles
```

## Key Integration Points

### Client-side initialization (main.tsx)

```typescript
import posthog from "posthog-js"
import { PostHogProvider } from "@posthog/react"

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

**Important**: Identify the user once on the client-side to consolidate the new user ID and the automatically generated anonymous ID. Don't identify again on the server-side.

### Event tracking (Burrito.tsx)

```typescript
posthog?.capture('burrito_considered', {
  total_considerations: updatedUser.burritoConsiderations,
  username: user.username,
});
```

### Error tracking (PostHogErrorBoundary)

The app is wrapped with `PostHogErrorBoundary` from `@posthog/react` in `main.tsx` to automatically capture unhandled React errors:

```typescript
<PostHogProvider client={posthog}>
  <PostHogErrorBoundary>
    {/* app content */}
  </PostHogErrorBoundary>
</PostHogProvider>
```

Manual error capture can also be added to components using `posthog?.captureException(err)`.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 7 Documentation](https://reactrouter.com)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
