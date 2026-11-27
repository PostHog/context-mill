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

Copy `.env.example` to `.env` in the root directory and set your project token:

```bash
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).
If the project token is not set, the app skips PostHog initialization and logs an error in development.

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
│   └── Profile.jsx          # User profile page
├── main.jsx                 # App entry point with PostHog initialization
└── globals.css              # Global styles
```

## Key Integration Points

### Client-side initialization (main.jsx)

```javascript
import posthog from 'posthog-js';
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react';

// Read the project token without a fallback value. When it is missing, leave the client uninitialized()
// and PostHogProvider rather than initializing the SDK with a placeholder key.
const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: '2026-08-30',
  });
}

{posthogToken ? (
  <PostHogProvider client={posthog}>
    <PostHogErrorBoundary>{app}</PostHogErrorBoundary>
  </PostHogProvider>
) : (
  app
)}
```

### User identification (AuthContext.jsx, Header.jsx)

Users are identified on the client-side with a stable UUID (`localUser.id`) on login and when restoring a persisted session from `localStorage` on reload. `username` is sent only as a person property, never as `distinctId` or in `capture()` event properties.

```javascript
posthog?.identify(localUser.id, { username: localUser.username });
posthog?.capture('user_logged_in', { is_new_user: isNewUser });
```

On logout from an active session, capture `user_logged_out` before calling `reset()`:

```javascript
if (user) {
  posthog?.capture('user_logged_out');
  posthog?.reset();
}
```

The session and distinct ID can be passed to a backend by including the `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers. Do not identify users on the server-side.

### Event tracking (Burrito.jsx)

```javascript
posthog?.capture('burrito_considered', {
  total_considerations: updatedUser.burritoConsiderations,
});
```

### Error tracking

When a project token is configured, the app wraps routes with `PostHogErrorBoundary` from `@posthog/react` in `main.jsx` to capture unhandled React render errors. Manual error capture can be added to components using `posthog?.captureException(err)`.

## Reverse proxy

Ad blockers drop requests sent to PostHog's domain, so some events never arrive. A reverse proxy sends events through your own domain instead.

The recommended option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which PostHog hosts for you. You create a subdomain in your [organization proxy settings](https://app.posthog.com/settings/organization-proxy) and add a CNAME record at your DNS provider.

If you prefer to run your own, PostHog has guides for [Vercel](https://posthog.com/docs/advanced/proxy/vercel), [Netlify](https://posthog.com/docs/advanced/proxy/netlify) and [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare), among others. See [Deploy a reverse proxy](https://posthog.com/docs/advanced/proxy) for the full list.

Once the proxy is live, set `VITE_PUBLIC_POSTHOG_HOST` to the proxy URL, for example `https://yoursubdomain.myapp.com`. Also add `ui_host` to the `posthog.init` options, set to your PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`), so the toolbar and links into PostHog keep working.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router 6 Documentation](https://reactrouter.com/en/6.28.0)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)
