# PostHog Fastify example

A small Fastify 5 API ("burrito app") that shows how to integrate PostHog with `posthog-node` in a server application.

## Features

- **Plugin**: one PostHog client per process (or `null` when unconfigured), decorated onto the app as `app.posthog`
- **Request context**: an `onRequest` hook runs each request inside `posthog.withContext`, so captures carry the visitor
- **Graceful shutdown**: an `onClose` hook flushes queued events when the app closes
- **User identification**: `POST /login` validates input and identifies the user with a stable UUID
- **Signed-out visitors**: a per-visit cookie UUID with the `process_person_profile: false` option
- **Event capture**: `POST /burrito` sends `burrito_considered`
- **Feature flags**: `GET /dashboard` evaluates `new-dashboard-feature` with safe fallback
- **Error tracking**: `setErrorHandler` captures 5xx errors (`GET /profile` throws one)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure PostHog

```bash
cp .env.example .env
```

Set `POSTHOG_PROJECT_TOKEN` to your project token. Set `POSTHOG_HOST` to `https://eu.i.posthog.com` for an EU project. When the token is missing, `app.posthog` is `null`, a warning is logged once outside production, and the app still boots and handles requests cleanly.

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
├── server.ts            # Registers plugins and routes, closes the app on SIGINT/SIGTERM
├── routes.ts            # Routes: login, burrito, dashboard, profile
└── plugins/
    ├── auth.ts          # Cookies, in-memory users and sessions, request.user
    └── posthog.ts       # Client, request context hook, error handler, shutdown
```

## Key integration points

### Plugin with request context

```typescript
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()
if (!token) {
  app.decorate('posthog', null)
  return
}

const posthog = new PostHog(token, {
  host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
})

app.decorate('posthog', posthog)

// Keep this hook callback-based so done() inside withContext continues the request in that context.
app.addHook('onRequest', (request, reply, done) => {
  posthog.withContext({ distinctId, properties, options }, done, { fresh: true })
})
```

Register the auth plugin first so `request.user` is set before this hook reads it.

### Errors and shutdown

```typescript
app.setErrorHandler((error, request, reply) => {
  if (statusCode >= 500) {
    app.posthog?.captureException(error, { properties: { $response_status_code: statusCode } })
  }
  reply.code(statusCode).send({ error: 'Internal server error' })
})

app.addHook('onClose', async () => {
  await posthog.shutdown(3000)
})
```

### Capturing inside a request

```typescript
// The distinct id and request properties come from the context.
app.posthog?.capture({ event: 'burrito_considered', properties: { source: 'api' } })

const flags = await app.posthog?.evaluateFlags()
const newDashboard = flags?.isEnabled('new-dashboard-feature') ?? false
```

## Reverse proxy

This is a server-only app, so it does not need a reverse proxy. A proxy only helps browser code avoid ad blockers.

## Learn more

- [PostHog Fastify docs](https://posthog.com/docs/libraries/fastify)
- [PostHog Node.js SDK docs](https://posthog.com/docs/libraries/node)
