# PostHog Next.js app router example

This is a [Next.js](https://nextjs.org) App Router example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification and session restore
- **Server-side & Client-side tracking**: Examples of both tracking methods
- **Reverse proxy**: PostHog ingestion through Next.js rewrites

## Getting started

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` in the root directory and fill in your PostHog project token:

```bash
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). `.env.example` lists the variable names. If the token is missing, the app still builds and runs, and logs an error in development instead of initializing PostHog.

### 3. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── login/
│   │           └── route.ts   # Login API with server-side tracking
│   ├── burrito/
│   │   └── page.tsx           # Demo feature page with event tracking
│   ├── profile/
│   │   └── page.tsx           # User profile with error tracking demo
│   ├── layout.tsx             # Root layout with providers
│   ├── page.tsx               # Home/Login page
│   └── globals.css            # Global styles
├── components/
│   └── Header.tsx             # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx        # Authentication context with PostHog integration
└── lib/
    └── posthog-server.ts      # Server-side PostHog client

instrumentation-client.ts      # Client-side PostHog initialization
```

## Key integration points

### Client-side initialization (instrumentation-client.ts)

```typescript
import posthog from "posthog-js"

const rawToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const token = rawToken?.trim()

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.includes("eu.") ? "https://eu.posthog.com" : "https://us.posthog.com",
    defaults: '2026-08-30',
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
} else if (process.env.NODE_ENV === "development") {
  console.error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured")
}
```

### User identification and logout (AuthContext.tsx)

Identify with the user's stable UUID on login and when restoring a persisted session on reload, keep `username` in person properties rather than `capture()` event properties, and capture `user_logged_out` before calling `reset()`:

```typescript
posthog.identify(user.id, {
  username: user.username,
});

posthog.capture('user_logged_in', {
  login_method: 'username',
});

// On logout from an authenticated session, capture before reset()
posthog.capture('user_logged_out');
posthog.reset();
```

### Event tracking (burrito/page.tsx)

```typescript
posthog.capture('burrito_considered', {
  total_considerations: nextCount,
});
```

### Error tracking (profile/page.tsx)

```typescript
posthog.captureException(error);
```

### Server-side tracking (app/api/auth/login/route.ts)

```typescript
const posthog = getPostHogClient();
posthog?.capture({
  distinctId: user.id,
  event: 'server_login',
  properties: {
    isNewUser,
    source: 'api',
  },
});
await posthog?.flush().catch(() => {});
```

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. This example sends events through your own domain instead. `next.config.ts` rewrites `/ingest/static/*` and `/ingest/array/*` to PostHog's assets host and every other `/ingest/*` request to PostHog's ingestion host. `instrumentation-client.ts` sets `api_host: "/ingest"` so the SDK uses that path, and `ui_host` keeps toolbar links pointing at PostHog. `skipTrailingSlashRedirect` stops Next.js from redirecting PostHog's trailing-slash API paths.

The proxy follows the region in `NEXT_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. It derives the ingestion host, the assets host (`-assets.i.posthog.com`), and `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) from that one value, so an EU project only needs to set `NEXT_PUBLIC_POSTHOG_HOST`. Pick a proxy path unique to your app rather than a common name such as `/analytics` or `/telemetry`. If your host doesn't support rewrites, use the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy).

## App router differences from pages router

This example uses Next.js App Router instead of Pages Router. Key differences:

1. **File-based routing**: Pages in `src/app/` instead of `src/pages/`
2. **layout.tsx**: Root layout component wraps all pages
3. **API Routes**: Located in `src/app/api/` with `route.ts` files
4. **'use client'**: Client components need explicit directive
5. **useRouter**: From `next/navigation` instead of `next/router`
6. **Metadata**: Exported from layout/page instead of Head component
7. **Server Components**: Components are server-side by default

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [PostHog Next.js Integration Guide](https://posthog.com/docs/libraries/next-js)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
