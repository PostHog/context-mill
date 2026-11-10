# PostHog Hono example

A small Hono API ("burrito app") running on Node.js that shows how to integrate PostHog with `posthog-node` in a server application.

## Features

- **Middleware**: runs each request inside `posthog.withContext`, so captures carry the visitor
- **One client per process**: created once in `src/posthog.ts` and flushed on shutdown
- **User identification**: `POST /login` identifies the user once with their own id
- **Signed-out visitors**: a random id kept in a cookie for the visit, with `$process_person_profile: false`
- **Event capture**: `POST /burrito` sends `burrito_considered`
- **Feature flags**: `GET /dashboard` evaluates `new-dashboard-feature`
- **Error tracking**: `app.onError` captures exceptions (`GET /profile` throws one)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure PostHog

```bash
cp .env.example .env
```

Set `POSTHOG_PROJECT_TOKEN` to your project token. Set `POSTHOG_HOST` to `https://eu.i.posthog.com` for an EU project. If the token is missing the app still boots, logs a warning outside production, and sends nothing.

### 3. Run the app

```bash
pnpm dev
```

### 4. Try it out

```bash
curl -c jar -b jar -X POST localhost:3000/burrito
curl -c jar -b jar -X POST -H 'content-type: application/json' -d '{"username":"ada"}' localhost:3000/login
curl -c jar -b jar -X POST localhost:3000/burrito
curl -c jar -b jar localhost:3000/dashboard
curl -c jar -b jar localhost:3000/profile
```

## Project structure

```text
src/
├── index.ts       # Routes, error handler, server and shutdown
├── auth.ts        # Cookie sessions and in-memory users
└── posthog.ts     # The PostHog client and the request context middleware
```

## Key integration points

### Client and middleware

```typescript
export const posthog = new PostHog(token ?? '', {
  host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
  disabled: !token,
})

export const posthogMiddleware = createMiddleware(async (c, next) => {
  // distinctId is the signed-in user's id, or a random visit id with
  // $process_person_profile: false for signed-out visitors.
  return posthog.withContext({ distinctId, properties }, next, { fresh: true })
})
```

Register the auth middleware first so `user` is set before PostHog reads it. The server flushes the client once on shutdown with `posthog.shutdown(3000)`, so there is no flush per request.

### Capturing inside a request

```typescript
// The distinct id and request properties come from the context.
posthog.capture({ event: 'burrito_considered' })

const flags = await posthog.evaluateFlags()
flags.isEnabled('new-dashboard-feature')
```

### Error tracking

```typescript
app.onError((err, c) => {
  posthog.captureException(err, undefined, { $request_path: c.req.path })
  return c.json({ error: 'Internal server error' }, 500)
})
```

## Reverse proxy

This is a server-only app, so it does not need a reverse proxy. A proxy only helps browser code avoid ad blockers.

## Learn more

- [PostHog Hono docs](https://posthog.com/docs/libraries/hono)
- [PostHog Node.js SDK docs](https://posthog.com/docs/libraries/node)
