# PostHog React Router 6 example

This is a [React Router 6](https://reactrouter.com) example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Client-side Tracking**: Examples of client-side tracking methods

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
│   └── Header.jsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.jsx      # Authentication context with PostHog integration
├── routes/
│   ├── Root.jsx             # Root route component
│   ├── Home.jsx             # Home/Login page
│   ├── Burrito.jsx          # Demo feature page with event tracking
│   └── Profile.jsx            # User profile with error tracking demo
├── main.jsx                 # App entry point with PostHog initialization
└── globals.css              # Global styles
```

## Key Integration Points

### Client-side initialization (main.jsx)

```javascript
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

### User identification (AuthContext.jsx)

The user is identified when the user logs in on the **client-side**.

```javascript
posthog.identify(username);
posthog.capture('user_logged_in');
```

The session and distinct ID can be passed to the backend by including the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers.

You should use these headers in the backend to identify events. 

**Important**: do not identify users on the server-side.

### Event tracking (Burrito.jsx)

```javascript
posthog?.capture('burrito_considered', {
  total_considerations: updatedUser.burritoConsiderations,
  username: user.username,
});
```

### Error tracking

**Note**: The app can be wrapped with `PostHogErrorBoundary` from `@posthog/react` (imported in `main.jsx`) to automatically capture unhandled React errors. Manual error capture can be added to components using `posthog?.captureException(err)`.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 6 Documentation](https://reactrouter.com/en/6.28.0)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
