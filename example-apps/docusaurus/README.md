# PostHog Docusaurus example

A minimal [Docusaurus](https://docusaurus.io) 3 site that uses the [`posthog-docusaurus`](https://github.com/PostHog/posthog-docusaurus) plugin to add PostHog analytics, session replay, feature flags and error tracking.

## Features

- **Product analytics**: pageviews, autocapture and a custom `burrito_considered` event
- **Session replay**: recordings start with the plugin's posthog-js snippet
- **Feature flags**: `isFeatureEnabled()` gates a tip in the demo page
- **Error tracking**: `captureException()` from a try/catch
- **User identification**: a demo sign-in that persists session state, calls `identify()` on sign-in and reload, and captures `user_logged_out` before `reset()` on sign-out

## Getting started

### 1. Install dependencies

```bash
pnpm install
# or
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your PostHog project token:

```bash
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://us.i.posthog.com
```

Get your project token from your [PostHog project settings](https://app.posthog.com/project/settings). Use `https://eu.i.posthog.com` as the host for an EU Cloud project.

If the token is missing, the site still builds and runs. `docusaurus.config.ts` skips registering the plugin, logs a warning outside production during the Node build, and loads `src/posthog-client.ts` in development so the browser console logs a missing-token error.

### 3. Run the site

```bash
pnpm start   # http://localhost:3000
pnpm build && pnpm serve
```

## Project structure

```
.
├── docusaurus.config.ts    # Registers posthog-docusaurus when POSTHOG_PROJECT_TOKEN is set
├── sidebars.ts
├── docs/
│   └── intro.md
└── src/
    ├── pages/
    │   └── burrito.tsx     # Demo page with identify, session restore, custom event, feature flag, error capture
    ├── posthog-client.ts   # Logs browser console.error in dev when POSTHOG_PROJECT_TOKEN is missing
    └── posthog.d.ts        # Types for window.posthog
```

## Key integration points

### Plugin setup (docusaurus.config.ts)

```typescript
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()
const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com"

plugins: [
  ...(token
    ? [
        [
          "posthog-docusaurus",
          {
            apiKey: token,
            appUrl: host,
            enableInDevelopment: true,
            defaults: "2026-08-30",
            capture_pageview: false,
          },
        ],
      ]
    : []),
]
```

The plugin injects the posthog-js snippet into the page head and exposes the client as `window.posthog`. Any option besides `apiKey`, `appUrl` and `enableInDevelopment` is passed through to `posthog.init()`, so `defaults` goes there. Options go through `JSON.stringify()`, so functions such as `before_send` are not supported. The plugin captures its own `$pageview` on every route change, including the first page load, so `capture_pageview: false` stops the SDK from sending a second one.

The plugin throws when `apiKey` is empty, which is why the config only registers it when a token is set instead of passing a placeholder value. It only loads PostHog in production builds unless `enableInDevelopment` is `true`. The token is read at build time and ends up in the generated HTML, which is expected for a project token.

### Identify, capture and reset (src/pages/burrito.tsx)

```typescript
window.posthog?.identify(getUserId(trimmed), { username: trimmed })
window.posthog?.capture("user_logged_in", { login_method: "username" })

window.posthog?.capture("burrito_considered", { total_considerations: nextCount })

// On sign-out from an authenticated session, capture before reset()
window.posthog?.capture("user_logged_out")
window.posthog?.reset()
```

Identify with your own stable user id (a primary key or UUID, never a username or email) on sign-in and when restoring a saved session on reload. Keep PII like `username` in `identify()` person properties rather than `capture()` event properties, and capture `user_logged_out` before calling `reset()` on sign-out.

### Feature flags and error capture

```typescript
window.posthog?.isFeatureEnabled("burrito-tip")

window.posthog?.captureException(err)
```

## Reverse proxy

The site is static, so there is no server code to host a proxy. To keep events from being blocked, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), set `POSTHOG_HOST` to your proxy domain, and pass `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) in the `posthog-docusaurus` plugin options so toolbar links keep pointing at PostHog.

## Learn more

- [PostHog Docusaurus docs](https://posthog.com/docs/libraries/docusaurus)
- [Docusaurus docs](https://docusaurus.io/docs)
