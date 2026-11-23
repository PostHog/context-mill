# PostHog Convex example

A [Convex](https://www.convex.dev) example showing PostHog product analytics, user identification, feature flags, and error tracking from inside Convex functions with the `@posthog/convex` component, plus a small React + Vite frontend that uses `posthog-js` with the same ids.

## Features

- **Product analytics**: capture a custom event (`burrito_considered`) from a mutation
- **User identification**: identify on login with the same id in the browser and in Convex; signed-out visitors use `posthog-js`'s random id and send anonymous events
- **Feature flags**: evaluate a flag from an action with `evaluateFlag()`
- **Error tracking**: report a handled error with `captureException()`
- **No flushing**: the component schedules each send with `ctx.scheduler.runAfter`, so nothing needs to be flushed or shut down

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

To add the component to your own Convex app (requires Convex 1.39 or newer):

```bash
pnpm add @posthog/convex
```

### 2. Configure environment variables

The Convex functions read PostHog config from the Convex deployment. The component declares `POSTHOG_PROJECT_TOKEN` as required, so set it before the first deploy:

```bash
npx convex env set POSTHOG_PROJECT_TOKEN phc_your_project_token_here
npx convex env set POSTHOG_HOST https://us.i.posthog.com
```

Use `https://eu.i.posthog.com` for EU Cloud. To evaluate flags locally in queries, also set `POSTHOG_PERSONAL_API_KEY` to a secret API key.

The frontend reads its config from `.env.local` (see `.env.example`):

```bash
cp .env.example .env.local
```

A missing `VITE_POSTHOG_PROJECT_TOKEN` skips `posthog-js` and logs an error in development. `npx convex dev` writes `VITE_CONVEX_URL` to `.env.local`.

### 3. Run the app

```bash
npx convex dev   # in one terminal: deploys functions and generates convex/_generated
pnpm dev         # in another terminal: starts the Vite frontend
```

Check types and the production build:

```bash
pnpm codegen
pnpm typecheck
pnpm build
```

## Project structure

```
convex/
├── convex.config.ts   # Registers the PostHog component and forwards its env vars
├── posthog.ts         # The PostHog client shared by all functions
├── burrito.ts         # Mutations and actions: login, events, flags, error tracking
└── tsconfig.json
src/
├── main.tsx           # posthog-js init and providers
└── App.tsx            # Login, burrito, dashboard and profile buttons
```

## Key integration points

### Register the component (convex/convex.config.ts)

Forward the credentials from the app down to the component.

```ts
const app = defineApp({
    env: {
        POSTHOG_PROJECT_TOKEN: v.string(),
        POSTHOG_HOST: v.optional(v.string()),
    },
})

app.use(posthog, {
    env: {
        POSTHOG_PROJECT_TOKEN: app.env.POSTHOG_PROJECT_TOKEN,
        POSTHOG_HOST: app.env.POSTHOG_HOST,
    },
})
```

### Client (convex/posthog.ts)

```ts
export const posthog = new PostHog(components.posthog)
```

### User identification (convex/burrito.ts)

Use your app's stable user id as `distinctId` and call `identify` once, on login. The browser calls `posthog.identify()` with the same id so frontend and backend events land on one person.

```ts
await posthog.identify(ctx, {
    distinctId: args.userId,
    properties: { email: args.email },
})
```

The demo has no auth provider, so the client passes its user id. In a real app, resolve the id on the server (for example with `ctx.auth`).

### Signed-out visitors (convex/burrito.ts)

The browser passes `posthog.get_distinct_id()`, a random id kept for the visit, and the function sets `$process_person_profile` to `false` so PostHog creates no person profile.

```ts
const properties = args.userId ? {} : { $process_person_profile: false }
```

### Event tracking (convex/burrito.ts)

`capture` works in mutations and actions and returns immediately. The send is rolled back if the mutation throws.

```ts
await posthog.capture(ctx, {
    distinctId: args.userId ?? args.anonymousId,
    event: "burrito_considered",
    properties: { total_considerations: args.totalConsiderations },
})
```

### Feature flags (convex/burrito.ts)

Remote evaluation works in actions without a personal API key. Errors are caught so PostHog never fails the action.

```ts
const enabled = await posthog.evaluateFlag(ctx, {
    key: "new-dashboard-feature",
    distinctId: args.userId ?? args.anonymousId,
})
```

### Error tracking (convex/burrito.ts)

```ts
await posthog.captureException(ctx, {
    error,
    distinctId: args.userId ?? args.anonymousId,
})
```

To forward every uncaught exception without wrapping call sites, configure Convex's [PostHog exception reporting](https://docs.convex.dev/production/integrations/exception-reporting) in the dashboard.

## Reverse proxy

The Convex functions send events from the server, so they do not need a reverse proxy. For the `posthog-js` frontend, see the [managed reverse proxy guide](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md).

## Learn more

- [PostHog Convex docs](https://posthog.com/docs/libraries/convex.md)
- [`@posthog/convex` README](https://github.com/PostHog/posthog-js/tree/main/packages/convex)
