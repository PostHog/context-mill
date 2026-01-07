# PostHog Next.js app router example

This is a [Next.js](https://nextjs.org) App Router example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification
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

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

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

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: '2025-11-30',
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

### Event tracking (burrito/page.tsx)

```typescript
posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (profile/page.tsx)

```typescript
posthog.captureException(error);
```

### Server-side tracking (app/api/auth/login/route.ts)

```typescript
const posthog = getPostHogClient();
posthog.capture({
  distinctId: username,
  event: 'server_login',
  properties: { ... }
});
```

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
