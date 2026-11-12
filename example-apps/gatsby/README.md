# PostHog Gatsby example

A minimal [Gatsby](https://www.gatsbyjs.com) 5 site that uses the community [`gatsby-plugin-posthog`](https://github.com/PostHog/gatsby-plugin-posthog) plugin to add PostHog analytics, session replay, feature flags and error tracking.

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
GATSBY_POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
GATSBY_POSTHOG_HOST=https://us.i.posthog.com
```

Get your project token from your [PostHog project settings](https://app.posthog.com/project/settings). Use `https://eu.i.posthog.com` as the host for an EU Cloud project.

If the token is missing, the site still builds and runs. `gatsby-config.ts` leaves the plugin out and logs a warning outside production.

### 3. Run the site

```bash
pnpm develop   # http://localhost:8000
pnpm build && pnpm serve
```

## Project structure

```
.
├── gatsby-config.ts        # Registers gatsby-plugin-posthog with the token and host from env
└── src/
    ├── pages/
    │   └── index.tsx       # Demo page: identify, custom event, feature flag, error capture
    └── posthog.d.ts        # Types for window.posthog
```

## Key integration points

### Plugin setup (gatsby-config.ts)

```typescript
{
  resolve: "gatsby-plugin-posthog",
  options: {
    apiKey: token,
    apiHost: host,
    isEnabledDevMode: true,
    initOptions: {
      defaults: "2026-08-30",
      capture_pageview: false,
    },
  },
}
```

The plugin injects the posthog-js snippet into the page head and exposes the client as `window.posthog`. It has no `defaults` option of its own, but `initOptions` is passed through to `posthog.init()`, so `defaults` goes there. The plugin captures its own `$pageview` on every route change, including the first page load, so `capture_pageview: false` stops the SDK from sending a second one.

The plugin only loads PostHog in production builds unless `isEnabledDevMode` is `true`. The token is read in `gatsby-config.ts` at build time and ends up in the generated HTML, which is expected for a project token.

### Identify, capture and reset (src/pages/index.tsx)

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

The site is static, so there is no server code to host a proxy. To keep events from being blocked, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md), then set `GATSBY_POSTHOG_HOST` to your proxy domain.

## Learn more

- [PostHog Gatsby docs](https://posthog.com/docs/libraries/gatsby)
- [Gatsby docs](https://www.gatsbyjs.com/docs)
