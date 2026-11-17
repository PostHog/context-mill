# PostHog Vue 3 + Vite example

This is a [Vue 3](https://vuejs.org/) + [Vite](https://vitejs.dev/) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

It uses the `posthog-js` browser SDK directly and shows how to:

- Initialize PostHog in a Vue 3 SPA
- Identify users after login
- Track custom events from components
- Capture errors via Vue’s global `errorHandler`
- Reset PostHog state on logout

## Features

- **Product analytics**: Track login and burrito consideration events
- **Session replay**: Enabled via `posthog-js` configuration
- **Error tracking**: Global Vue error handler sends exceptions to PostHog
- **Simple auth flow**: Demo login + protected routes using Pinia + Vue Router

## Getting started

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```bash
VITE_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your project settings in PostHog.
If the project token is not set, the app skips PostHog initialization and logs a warning in development.

### 3. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open `http://localhost:5173` (or whatever Vite prints) in your browser.

## Project structure

```text
src/
  main.ts            # Vue app entrypoint, PostHog init + global errorHandler
  router/
    index.ts         # Routes + simple auth guard
  stores/
    auth.ts          # Pinia auth store (login, logout, user state)
  components/
    Header.vue       # Navigation + logout, calls posthog.reset()
  views/
    Home.vue         # Login form, identifies user + captures 'user_logged_in'
    Burrito.vue      # Burrito consideration demo, captures 'burrito_considered'
    Profile.vue      # Profile + error tracking demo (if implemented)
  App.vue            # Root layout
```

## Key integration points

### PostHog initialization (`src/main.ts`)

`posthog-js` is initialized once when the app boots:

```ts
import posthog from 'posthog-js'

const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-08-30',
  })
}

app.config.errorHandler = (err) => {
  posthog.captureException(err)
}
```

This ensures:

- The SDK is configured with your project key and host
- The singleton instance is initialized only once and before the app mounts
- Any uncaught Vue errors are sent to PostHog

### User identification (`src/views/Home.vue`)

After a successful “login”, the app identifies the user and captures a login event:

```ts
const success = await authStore.login(username.value, password.value)
if (success) {
  posthog.identify(username.value)
  posthog.capture('user_logged_in')
}
```

Identification happens **only on login**, all further requests will automatically use the same distinct ID.

### Event tracking (`src/views/Burrito.vue`)

The burrito page tracks a custom event when a user “considers” the burrito:

```ts
posthog.capture('burrito_considered', {
  total_considerations: updatedUser.burritoConsiderations,
  username: updatedUser.username,
})
```

This shows how to attach useful properties to events (e.g. counts, usernames).

### Logout and session reset (`src/components/Header.vue`)

On logout, both the local auth state and PostHog state are cleared:

```ts
authStore.logout()
posthog.reset()
router.push({ name: 'home' })
```

`posthog.reset()` clears the current distinct ID and session so the next login starts a fresh identity.

## Scripts

```bash
# Run dev server
npm run dev

# Type-check, compile, and minify for production
npm run build

# Lint
npm run lint
```

## Reverse proxy

Ad blockers drop requests sent to PostHog's domain, so some events never arrive. A reverse proxy sends events through your own domain instead.

The recommended option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which PostHog hosts for you. You create a subdomain in your [organization proxy settings](https://app.posthog.com/settings/organization-proxy) and add a CNAME record at your DNS provider.

If you prefer to run your own, PostHog has guides for [Vercel](https://posthog.com/docs/advanced/proxy/vercel), [Netlify](https://posthog.com/docs/advanced/proxy/netlify) and [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare), among others. See [Deploy a reverse proxy](https://posthog.com/docs/advanced/proxy) for the full list.

Once the proxy is live, set `VITE_POSTHOG_HOST` to the proxy URL, for example `https://yoursubdomain.myapp.com`. Also add `ui_host` to the `posthog.init` options, set to your PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`), so the toolbar and links into PostHog keep working.

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [posthog-js SDK](https://posthog.com/docs/libraries/js)
- [Vue 3 documentation](https://vuejs.org/guide/introduction.html)
- [Vite documentation](https://vitejs.dev/guide/)
