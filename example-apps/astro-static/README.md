# PostHog Astro Static Example

This is an [Astro](https://astro.build/) static site (SSG) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

It uses the PostHog web snippet directly and shows how to:

- Initialize PostHog in a static Astro site using a reusable component
- Identify users on login and restore identity on page reloads
- Track custom events from pages
- Capture errors via `posthog.captureException()`
- Reset PostHog state on logout

## Features

- **Product analytics**: Track login and burrito consideration events
- **Session replay**: Enabled via PostHog snippet configuration
- **Error tracking**: Manual error capture sent to PostHog
- **Simple auth flow**: Demo login using localStorage

## Getting started

### 1. Install dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the project root and set your project token:

```bash
PUBLIC_POSTHOG_PROJECT_TOKEN=
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your project settings in PostHog. Leave `PUBLIC_POSTHOG_PROJECT_TOKEN` blank until you have a real token. When the token is unset, the app still builds and runs: in development it logs an error naming the variable and skips PostHog initialization.

### 3. Run the development server

```bash
npm run dev
# or
pnpm dev
```

Open `http://localhost:4321` in your browser.

## Project structure

```text
src/
  components/
    posthog.astro      # PostHog snippet with is:inline directive
    Header.astro       # Navigation + logout, calls posthog.reset()
  layouts/
    PostHogLayout.astro # Root layout that includes PostHog + Header
  lib/
    auth.ts            # Auth utilities (localStorage-based)
  pages/
    index.astro        # Login form, identifies user + captures 'user_logged_in'
    burrito.astro      # Burrito consideration demo, captures 'burrito_considered'
    profile.astro      # Profile + error tracking demo
  styles/
    global.css         # Global styles
```

## Key integration points

### PostHog initialization (`src/components/posthog.astro`)

The PostHog snippet is included as an inline script to prevent Astro from processing it, and only initializes when `PUBLIC_POSTHOG_PROJECT_TOKEN` is configured:

```astro
<script is:inline define:vars={{ apiKey: import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN, apiHost: import.meta.env.PUBLIC_POSTHOG_HOST, isDev: import.meta.env.DEV }}>
  !function(t,e){...}(document,window.posthog||[]);
  if (apiKey && apiKey.trim()) {
    posthog.init(apiKey, {
      api_host: apiHost || 'https://us.i.posthog.com',
      defaults: '2026-08-30'
    })
    const currentUser = localStorage.getItem('currentUser')
    if (currentUser) {
      posthog.identify(getUserId(currentUser), { username: currentUser })
    }
  }
</script>
```

The `is:inline` directive is required to prevent TypeScript errors about `window.posthog`.

### User identification (`src/pages/index.astro`)

After a successful login, the app identifies the user with a stable user ID and captures a login event:

```javascript
window.posthog?.identify(getUserId(username), { username });
window.posthog?.capture("user_logged_in");
```

Identification runs on login and on page reloads when a logged-in session is restored from `localStorage`, keeping `username` in person properties rather than event properties.

### Event tracking (`src/pages/burrito.astro`)

The burrito page tracks a custom event when a user considers a burrito:

```javascript
window.posthog?.capture("burrito_considered", {
  total_considerations: newCount,
});
```

Attach safe non-PII metadata such as counts to event properties.

### Error tracking (`src/pages/profile.astro`)

The profile page includes a button to trigger a test error:

```javascript
try {
  throw new Error("Test error for PostHog error tracking");
} catch (err) {
  window.posthog?.captureException(err);
}
```

### Logout and session reset (`src/components/Header.astro`)

When logging out of an authenticated session, capture the logout event before resetting PostHog:

```javascript
if (currentUser) {
  window.posthog?.capture("user_logged_out");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("burritoConsiderations");
  window.posthog?.reset();
}
```

`posthog.reset()` clears the current distinct ID and session so the next login starts a fresh identity.

## Scripts

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Reverse proxy

Ad blockers drop events sent to PostHog's domain. Routing events through your own domain avoids that.

This example does not proxy requests: it has no server to run a proxy on, so the browser sends events straight to `PUBLIC_POSTHOG_HOST`. To use a proxy, point `PUBLIC_POSTHOG_HOST` at a proxy you host (for example on Cloudflare) and set `ui_host` in `posthog.init` to your PostHog app URL so toolbar links still work. If your app can't proxy requests itself, use PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which is free for PostHog Cloud users.

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Astro guide](https://posthog.com/docs/libraries/astro)
- [Astro documentation](https://docs.astro.build/)
