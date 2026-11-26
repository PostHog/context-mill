# PostHog Astro View Transitions Example

This is an [Astro](https://astro.build/) example demonstrating PostHog integration with [View Transitions](https://docs.astro.build/en/guides/view-transitions/) (ClientRouter) for SPA-like navigation.

It uses the PostHog web snippet with an initialization guard to prevent stack overflow errors during soft navigation, and shows how to:

- Initialize PostHog with an initialization guard for View Transitions
- Track pageviews automatically during soft navigation
- Identify users on login and restore identity on full page reloads
- Track custom events from pages
- Capture errors via `posthog.captureException()`
- Reset PostHog state on logout

## Features

- **View Transitions**: Smooth client-side navigation with `<ClientRouter />`
- **Product analytics**: Track login and burrito consideration events
- **Automatic pageview tracking**: Uses `capture_pageview: 'history_change'` for soft navigation
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
    posthog.astro      # PostHog snippet with initialization guard
    Header.astro       # Navigation + logout, uses astro:page-load event
  layouts/
    PostHogLayout.astro # Root layout with <ClientRouter /> and PostHog
  lib/
    auth.ts            # Auth utilities (localStorage-based)
  pages/
    index.astro        # Login form, identifies user + captures 'user_logged_in'
    burrito.astro      # Burrito consideration demo, captures 'burrito_considered'
    profile.astro      # Profile + error tracking demo
  styles/
    global.css         # Global styles + view transition animations
```

## Key integration points

### PostHog initialization with View Transitions (`src/components/posthog.astro`)

When using Astro's View Transitions (ClientRouter), wrap the PostHog initialization with a guard to prevent stack overflow errors, and only initialize when `PUBLIC_POSTHOG_PROJECT_TOKEN` is configured:

```astro
<script is:inline define:vars={{ apiKey: import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN, apiHost: import.meta.env.PUBLIC_POSTHOG_HOST, isDev: import.meta.env.DEV }}>
  // Guard against multiple initializations during view transitions
  if (!window.__posthog_initialized) {
    window.__posthog_initialized = true;
    !function(t,e){...}(document,window.posthog||[]);
    if (apiKey && apiKey.trim()) {
      posthog.init(apiKey, {
        api_host: apiHost || 'https://us.i.posthog.com',
        defaults: '2026-08-30',
        // Use 'history_change' for automatic pageview tracking during soft navigation
        capture_pageview: 'history_change'
      })
      const currentUser = localStorage.getItem('currentUser')
      if (currentUser) {
        posthog.identify(getUserId(currentUser), { username: currentUser })
      }
    }
  }
</script>
```

Without this guard, ClientRouter's soft navigation can re-execute the inline script during page transitions and cause a stack overflow error.

The `capture_pageview: 'history_change'` option ensures pageviews are tracked automatically as users navigate between pages.

### Layout with ClientRouter (`src/layouts/PostHogLayout.astro`)

The layout includes Astro's ClientRouter for smooth page transitions:

```astro
---
import { ClientRouter } from 'astro:transitions';
import PostHog from '../components/posthog.astro';
---
<html>
  <head>
    <ClientRouter />
    <PostHog />
  </head>
  ...
</html>
```

### Handling View Transitions in scripts

When using View Transitions, set up event listeners after each page navigation:

```javascript
function setupPage() {
  // Your setup code here
}

// Run on initial page load
document.addEventListener("DOMContentLoaded", setupPage);

// Run after view transitions complete (for soft navigation)
document.addEventListener("astro:page-load", setupPage);
```

### User identification (`src/pages/index.astro`)

After a successful login, the app identifies the user with a stable user ID and captures a login event:

```javascript
window.posthog?.identify(getUserId(username), { username });
window.posthog?.capture("user_logged_in");
```

### Event tracking (`src/pages/burrito.astro`)

The burrito page tracks a custom event when a user considers a burrito, keeping PII out of event properties:

```javascript
window.posthog?.capture("burrito_considered", {
  total_considerations: newCount,
});
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
- [Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/)
- [Astro documentation](https://docs.astro.build/)
