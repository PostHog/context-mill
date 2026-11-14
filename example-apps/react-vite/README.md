# PostHog React + Vite example

A minimal [React](https://react.dev) application built with [Vite](https://vite.dev), demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

This example uses no client-side router, making it the simplest possible React + PostHog setup.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Feature Flags**: Toggle features with `useFeatureFlagEnabled()`
- **Error Tracking**: Automatic error capture with `PostHogErrorBoundary`
- **User Authentication**: Demo login system with PostHog user identification

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
VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
VITE_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).
If the project token is not set, the app skips PostHog initialization and logs a warning in development.

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
│   └── AuthContext.jsx       # Authentication context
├── pages/
│   ├── Home.jsx              # Home/Login page with event tracking
│   ├── Burrito.jsx           # Demo page with feature flags
│   └── Profile.jsx           # User profile page
├── main.jsx                  # Entry point with PostHog initialization
├── App.jsx                   # App component with page routing
└── globals.css               # Global styles
```

## Key Integration Points

### Initialization (main.jsx)

```javascript
import posthog from 'posthog-js'
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: '2026-08-30',
  })
}

<PostHogProvider client={posthog}>
  <PostHogErrorBoundary>
    <App />
  </PostHogErrorBoundary>
</PostHogProvider>
```

### User identification (Home.jsx)

```javascript
posthog.identify(username, { name: username })
posthog.capture('user_logged_in')
```

### Feature flags (Burrito.jsx)

```javascript
import { useFeatureFlagEnabled } from '@posthog/react'

const showSpecialBurrito = useFeatureFlagEnabled('special-burrito')
```

### Pageview tracking (Header.jsx)

Without a router, manually capture pageviews on navigation:

```javascript
posthog.capture('$pageview', { $current_url: `/${target}` })
```

## Reverse proxy

Ad blockers drop requests sent to PostHog's domain, so some events never arrive. A reverse proxy sends events through your own domain instead.

The recommended option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which PostHog hosts for you. You create a subdomain in your [organization proxy settings](https://app.posthog.com/settings/organization-proxy) and add a CNAME record at your DNS provider.

If you prefer to run your own, PostHog has guides for [Vercel](https://posthog.com/docs/advanced/proxy/vercel), [Netlify](https://posthog.com/docs/advanced/proxy/netlify) and [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare), among others. See [Deploy a reverse proxy](https://posthog.com/docs/advanced/proxy) for the full list.

Once the proxy is live, set `VITE_PUBLIC_POSTHOG_HOST` to the proxy URL, for example `https://yoursubdomain.myapp.com`. Also add `ui_host` to the `posthog.init` options, set to your PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`), so the toolbar and links into PostHog keep working.

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog React SDK](https://posthog.com/docs/libraries/react)
- [Vite Documentation](https://vite.dev)
