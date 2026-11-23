# PostHog NestJS example

A small NestJS API ("burrito app") that shows how to integrate PostHog with `posthog-node` in a server application.

## Features

- **Client module**: a global `PostHogModule` and an injectable `PostHogService` own the single client for the process
- **Graceful shutdown**: `onApplicationShutdown` flushes queued events when the app stops
- **User identification**: `POST /login` identifies the user once with their own id
- **Signed-out visitors**: a random id kept in a cookie for the visit, with `$process_person_profile: false`
- **Event capture**: `POST /burrito` sends `burrito_considered`
- **Feature flags**: `GET /dashboard` evaluates `new-dashboard-feature`
- **Error tracking**: `PostHogInterceptor` captures unhandled 5xx errors (`GET /profile` throws one)

## Getting started

The interceptor's `getDistinctId` option needs `posthog-node` 5.68.0 or later.

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
├── main.ts                  # Bootstrap, cookie parser, shutdown hooks
├── app.module.ts            # Root module, applies the visitor middleware
├── app.controller.ts        # Routes: login, burrito, dashboard, profile
├── auth.service.ts          # In-memory users and sessions
├── visitor.middleware.ts    # Resolves the user or a signed-out visit id
└── posthog/
    ├── posthog.module.ts    # Global module and interceptor
    └── posthog.service.ts   # The PostHog client and its shutdown
```

## Key integration points

### Client service with shutdown

```typescript
@Injectable()
export class PostHogService implements OnApplicationShutdown {
  readonly client = new PostHog(token ?? '', {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    enableExceptionAutocapture: true,
    disabled: !token,
  })

  async onApplicationShutdown() {
    await this.client.shutdown(3000)
  }
}
```

`main.ts` calls `app.enableShutdownHooks()` so the hook runs on SIGINT and SIGTERM.

### Interceptor for request context and errors

```typescript
{
  provide: APP_INTERCEPTOR,
  inject: [PostHogService],
  useFactory: (posthog: PostHogService) =>
    new PostHogInterceptor(posthog.client, {
      captureExceptions: true,
      getDistinctId: (request: VisitorRequest) => request.visitor?.user?.id,
    }),
}
```

`getDistinctId` tells the interceptor who the signed-in user is, so its context and the exceptions it captures carry that user even when the client doesn't run posthog-js. It wins over the `X-POSTHOG-DISTINCT-ID` tracing header. Signed-out requests return `undefined` and get a personless id.

### Identity belongs to the request

```typescript
this.posthog.client.identify({ distinctId: user.id, properties: { username: user.username } })

this.posthog.client.capture({
  distinctId: req.visitor.distinctId,
  event: 'burrito_considered',
  properties: req.visitor.properties, // { $process_person_profile: false } when signed out
})
```

### Feature flags

```typescript
const flags = await this.posthog.client.evaluateFlags(req.visitor.distinctId)
flags.isEnabled('new-dashboard-feature')
```

## Reverse proxy

This is a server-only app, so it does not need a reverse proxy. A proxy only helps browser code avoid ad blockers.

## Learn more

- [PostHog NestJS docs](https://posthog.com/docs/libraries/nestjs)
- [PostHog Node.js SDK docs](https://posthog.com/docs/libraries/node)
