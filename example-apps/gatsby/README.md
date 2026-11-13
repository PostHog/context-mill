# PostHog Gatsby example

A minimal [Gatsby](https://www.gatsbyjs.com) 5 site that uses the [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js) (`posthog-js`) to add PostHog analytics, session replay, feature flags and error tracking.

## Features

- **Product analytics**: pageviews, autocapture and a custom `burrito_considered` event
- **Session replay**: recordings start when posthog-js initializes
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

If the token is missing, the site still builds and runs. `gatsby-browser.ts` skips `posthog.init()`, and `gatsby-config.ts` logs a warning outside production.

### 3. Run the site

```bash
pnpm develop   # http://localhost:8000
pnpm build && pnpm serve
```

## Project structure

```
.
├── gatsby-browser.ts       # Initializes posthog-js when the site loads in the browser
├── gatsby-config.ts        # Loads .env and warns when the token is missing
└── src/
    └── pages/
        └── index.tsx       # Demo page: identify, custom event, feature flag, error capture
```

## Key integration points

### SDK setup (gatsby-browser.ts)

```typescript
import posthog from "posthog-js"

export const onClientEntry: GatsbyBrowser["onClientEntry"] = () => {
  const token = process.env.GATSBY_POSTHOG_PROJECT_TOKEN
  if (!token) return

  posthog.init(token, {
    api_host: process.env.GATSBY_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-08-30",
    capture_pageview: "history_change",
  })
}
```

`onClientEntry` runs once in the browser, before the first page renders, so PostHog initializes before any page code calls it. Gatsby changes routes with the History API, so `capture_pageview: "history_change"` captures a `$pageview` on the first page load and on each route change. You do not need an `onRouteUpdate` handler.

Gatsby inlines `GATSBY_`-prefixed environment variables into the browser bundle at build time. `gatsby-config.ts` loads `.env` with `dotenv`, so the token and host are available to `gatsby-browser.ts`. The token ends up in the generated JavaScript, which is expected for a project token.

> The `gatsby-plugin-posthog` plugin is deprecated. Use `posthog-js` directly, as this example shows.

### Identify, capture and reset (src/pages/index.tsx)

```typescript
import posthog from "posthog-js"

posthog.identify(username, { username })
posthog.capture("user_logged_in")

posthog.capture("burrito_considered", { total_considerations: n })

posthog.reset() // on sign-out
```

Identify once when the user signs in, with your own stable user id (a primary key or UUID, never an email), and call `reset()` on sign-out.

### Feature flags and error capture

```typescript
posthog.isFeatureEnabled("burrito-tip")

posthog.captureException(err)
```

## Reverse proxy

The site is static, so there is no server code to host a proxy. To keep events from being blocked, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md), then set `GATSBY_POSTHOG_HOST` to your proxy domain.

## Learn more

- [PostHog Gatsby docs](https://posthog.com/docs/libraries/gatsby)
- [Gatsby docs](https://www.gatsbyjs.com/docs)
