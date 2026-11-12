# PostHog Docusaurus example

A minimal [Docusaurus](https://docusaurus.io) 3 site that uses the [`posthog-docusaurus`](https://github.com/PostHog/posthog-docusaurus) plugin to add PostHog analytics, session replay, feature flags and error tracking.

## Features

- **Product analytics**: pageviews, autocapture and a custom `burrito_considered` event
- **Session replay**: recordings start with the plugin's posthog-js snippet
- **Feature flags**: `isFeatureEnabled()` gates a tip in the demo page
- **Error tracking**: `captureException()` from a try/catch
- **User identification**: a demo sign-in that calls `identify()`, and a sign-out that calls `reset()`

## Getting started

### 1. Install dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
POSTHOG_HOST=https://us.i.posthog.com
```

Get your project token from your [PostHog project settings](https://app.posthog.com/project/settings). Use `https://eu.i.posthog.com` as the host for an EU Cloud project.

If the token is missing, the site still builds and runs. `docusaurus.config.ts` leaves the plugin out and logs a warning outside production.

### 3. Run the site

```bash
pnpm start   # http://localhost:3000
pnpm build && pnpm serve
```

## Project structure

```
.
├── docusaurus.config.ts    # Registers posthog-docusaurus with the token and host from env
├── sidebars.ts
├── docs/
│   └── intro.md
└── src/
    ├── pages/
    │   └── burrito.tsx     # Demo page: identify, custom event, feature flag, error capture
    └── posthog.d.ts        # Types for window.posthog
```

## Key integration points

### Plugin setup (docusaurus.config.ts)

```typescript
[
  "posthog-docusaurus",
  {
    apiKey: token,
    appUrl: host,
    enableInDevelopment: true,
    defaults: "2026-08-30",
    capture_pageview: false,
  },
]
```

The plugin injects the posthog-js snippet into the page head and exposes the client as `window.posthog`. Any option besides `apiKey`, `appUrl` and `enableInDevelopment` is passed through to `posthog.init()`, so `defaults` goes there. Options go through `JSON.stringify()`, so functions such as `before_send` are not supported. The plugin captures its own `$pageview` on every route change, including the first page load, so `capture_pageview: false` stops the SDK from sending a second one.

The plugin throws when `apiKey` is empty, which is why the config only registers it when a token is set. It only loads PostHog in production builds unless `enableInDevelopment` is `true`. The token is read at build time and ends up in the generated HTML, which is expected for a project token.

### Identify, capture and reset (src/pages/burrito.tsx)

```typescript
window.posthog?.identify(username, { username })
window.posthog?.capture("user_logged_in")

window.posthog?.capture("burrito_considered", { total_considerations: n })

window.posthog?.reset() // on sign-out
```

Identify once when the user signs in, with your own stable user id (a primary key or UUID, never an email), and call `reset()` on sign-out.

### Feature flags and error capture

```typescript
window.posthog?.isFeatureEnabled("burrito-tip")

window.posthog?.captureException(err)
```

## Reverse proxy

The site is static, so there is no server code to host a proxy. To keep events from being blocked, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md), then set `POSTHOG_HOST` to your proxy domain.

## Learn more

- [PostHog Docusaurus docs](https://posthog.com/docs/libraries/docusaurus)
- [Docusaurus docs](https://docusaurus.io/docs)
