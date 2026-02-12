# PostHog Next.js pages router example

This is a [Next.js](https://nextjs.org) Pages Router example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **Reverse Proxy**: PostHog ingestion through Next.js rewrites

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project Structure

```
src/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── lib/
│   └── posthog-server.ts    # Server-side PostHog client
├── pages/
│   ├── _app.tsx             # App wrapper with Auth provider
│   ├── _document.tsx        # Document wrapper
│   ├── index.tsx            # Home/Login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   └── api/
│       └── auth/
│           └── login.ts     # Login API with server-side tracking
└── styles/
    └── globals.css          # Global styles

instrumentation-client.ts    # Client-side PostHog initialization
```

## Key Integration Points

### Client-side initialization (instrumentation-client.ts)

```typescript
import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: '2026-01-30',
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});
```

### User identification (AuthContext.tsx)

```typescript
posthog.identify(username, {
  username: username,
});
```

### Event tracking (burrito.tsx)

```typescript
posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (profile.tsx)

```typescript
posthog.captureException(error);
```

### Server-side tracking (api/auth/login.ts)

```typescript
const posthog = getPostHogClient();
posthog.capture({
  distinctId: username,
  event: 'server_login',
  properties: { ... }
});
```

## Pages router differences from app router

This example uses Next.js Pages Router instead of App Router. Key differences:

1. **File-based routing**: Pages in `src/pages/` instead of `src/app/`
2. **_app.tsx**: Custom App component wraps all pages
3. **API Routes**: Located in `src/pages/api/`
4. **No 'use client'**: All pages are client-side by default
5. **useRouter**: From `next/router` instead of `next/navigation`
6. **Head component**: Using `next/head` for metadata instead of `metadata` export

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Next.js Pages Router Documentation](https://nextjs.org/docs/pages)
- [PostHog Next.js Integration Guide](https://posthog.com/docs/libraries/next-js)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
