# PostHog Convex example

A [Convex](https://www.convex.dev) example showing PostHog product analytics, user identification, feature flags, and error tracking from inside Convex functions with the `@posthog/convex` component, plus a small React + Vite frontend that uses `posthog-js` with the same ids.

## Features

- **Product analytics**: capture a custom event (`burrito_considered`) from a mutation
- **User identification**: identify with the same stable UUID in the browser (on login and session restore) and in Convex, while signed-out visitors use a per-visit random id and send personless events
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

The Convex functions read PostHog config from the Convex deployment. `convex/convex.config.ts` declares `POSTHOG_PROJECT_TOKEN` as optional so deployments without PostHog configured still run and drop events cleanly. Set your credentials on the deployment:

```bash
npx convex env set POSTHOG_PROJECT_TOKEN <your_project_token>
npx convex env set POSTHOG_HOST https://us.i.posthog.com
```

Use `https://eu.i.posthog.com` for EU Cloud. To evaluate flags locally in queries, also set `POSTHOG_PERSONAL_API_KEY` to a secret API key.

The frontend reads its config from `.env.local` (see `.env.example`):

```bash
cp .env.example .env.local
```

Set `VITE_POSTHOG_PROJECT_TOKEN` in `.env.local`. When it is unset, `src/main.tsx` skips `posthog.init` and `<PostHogProvider>`, and logs an error in development. `npx convex dev` writes `VITE_CONVEX_URL` to `.env.local`.

### 3. Run the app

```bash
npx convex dev   # in one terminal: deploys functions and refreshes convex/_generated
pnpm dev         # in another terminal: starts the Vite frontend
```

Check types and the production build:

```bash
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
├── main.tsx           # Conditional posthog-js init and providers
└── App.tsx            # Login, session restore, burrito, dashboard, and profile actions
```

## Key integration points

### Register the component (convex/convex.config.ts)

Forward the credentials from the app down to the component, keeping `POSTHOG_PROJECT_TOKEN` optional rather than supplying a placeholder key.

```ts
const app = defineApp({
    env: {
        POSTHOG_PROJECT_TOKEN: v.optional(v.string()),
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

### User identification (convex/burrito.ts and src/App.tsx)

Use your app's stable user UUID as `distinctId` and pass email in person properties. On login, Convex calls `posthog.identify(ctx, ...)` and the browser calls `posthog?.identify(userId, { email })`. The browser also persists the session and calls `posthog?.identify(...)` on page reload so frontend and backend events stay on one person, and captures `user_logged_out` before `posthog?.reset()` on logout.

```ts
await posthog.identify(ctx, {
    distinctId: userId,
    properties: { email },
})
```

The demo has no auth provider, so the client passes its user id. In a real app, resolve the id on the server (for example with `ctx.auth`).

### Signed-out visitors (convex/burrito.ts)

`resolveVisitor(args)` checks for a trimmed `userId` first, then a per-visit `anonymousId` with `$process_person_profile: false` so PostHog creates no person profile. When both are blank, it returns `null` and skips PostHog calls rather than falling back to a shared `anonymous` string.

```ts
const visitor = resolveVisitor(args)
if (!visitor) return
```

### Event tracking (convex/burrito.ts)

`capture` works in mutations and actions and returns immediately. The send is rolled back if the mutation throws.

```ts
const visitor = resolveVisitor(args)
if (!visitor) return

await posthog.capture(ctx, {
    distinctId: visitor.distinctId,
    event: "burrito_considered",
    properties: {
        total_considerations: args.totalConsiderations,
        ...visitor.properties,
    },
})
```

### Feature flags (convex/burrito.ts)

Remote evaluation works in actions without a personal API key. Errors are caught so PostHog never fails the action.

```ts
const visitor = resolveVisitor(args)
if (!visitor) return { showNewFeature: false }

const enabled = await posthog.evaluateFlag(ctx, {
    key: "new-dashboard-feature",
    distinctId: visitor.distinctId,
})
```

### Error tracking (convex/burrito.ts)

```ts
const visitor = resolveVisitor(args)
if (visitor) {
    await posthog.captureException(ctx, {
        error,
        distinctId: visitor.distinctId,
        additionalProperties: visitor.properties,
    })
}
```

To forward every uncaught exception without wrapping call sites, configure Convex's [PostHog exception reporting](https://docs.convex.dev/production/integrations/exception-reporting) in the dashboard.

## Reverse proxy

The Convex functions send events from the server, so they do not need a reverse proxy. For the `posthog-js` frontend, see the [managed reverse proxy guide](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md).

## Learn more

- [PostHog Convex docs](https://posthog.com/docs/libraries/convex.md)
- [`@posthog/convex` README](https://github.com/PostHog/posthog-js/tree/main/packages/convex)
