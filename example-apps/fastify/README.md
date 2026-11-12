# PostHog Fastify example

A small Fastify 5 API ("burrito app") that shows how to integrate PostHog with `posthog-node` in a server application.

## Features

- **Plugin**: one PostHog client per process, decorated onto the app as `app.posthog`
- **Request context**: an `onRequest` hook runs each request inside `posthog.withContext`, so captures carry the visitor
- **Graceful shutdown**: an `onClose` hook flushes queued events when the app closes
- **User identification**: `POST /login` identifies the user once with their own id
- **Signed-out visitors**: a random id kept in a cookie for the visit, with `$process_person_profile: false`
- **Event capture**: `POST /burrito` sends `burrito_considered`
- **Feature flags**: `GET /dashboard` evaluates `new-dashboard-feature`
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
├── server.ts            # Registers plugins and routes, closes the app on SIGINT/SIGTERM
├── routes.ts            # Routes: login, burrito, dashboard, profile
└── plugins/
    ├── auth.ts          # Cookies, in-memory users and sessions, request.user
    └── posthog.ts       # Client, request context hook, error handler, shutdown
```

## Key integration points

### Plugin with request context

```typescript
const posthog = new PostHog(token ?? '', {
  host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
  disabled: !token,
})

app.decorate('posthog', posthog)

// Keep this hook callback-based: done() inside withContext continues the request in that context.
app.addHook('onRequest', (request, reply, done) => {
  posthog.withContext({ distinctId, properties }, done, { fresh: true })
})
```

Register the auth plugin first so `request.user` is set before this hook reads it.

### Errors and shutdown

```typescript
app.setErrorHandler((error, request, reply) => {
  if (statusCode >= 500) {
    posthog.captureException(error, undefined, { $response_status_code: statusCode })
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
app.posthog.capture({ event: 'burrito_considered' })

const flags = await app.posthog.evaluateFlags()
flags.isEnabled('new-dashboard-feature')
```

## Reverse proxy

This is a server-only app, so it does not need a reverse proxy. A proxy only helps browser code avoid ad blockers.

## Learn more

- [PostHog Fastify docs](https://posthog.com/docs/libraries/fastify)
- [PostHog Node.js SDK docs](https://posthog.com/docs/libraries/node)
