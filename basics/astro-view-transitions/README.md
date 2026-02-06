# PostHog Astro View Transitions Example

This is an [Astro](https://astro.build/) example demonstrating PostHog integration with [View Transitions](https://docs.astro.build/en/guides/view-transitions/) (ClientRouter) for SPA-like navigation.

It uses the PostHog web snippet with special handling to prevent stack overflow errors during soft navigation, and shows how to:

- Initialize PostHog with an initialization guard for View Transitions
- Track pageviews automatically during soft navigation
- Identify users after login
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

Create a `.env` file in the project root:

```bash
PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your project settings in PostHog.

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
    posthog.astro      # PostHog snippet WITH initialization guard
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

When using Astro's View Transitions (ClientRouter), you **must** wrap the PostHog initialization with a guard to prevent stack overflow errors:

```astro
<script is:inline>
  // IMPORTANT: Guard against multiple initializations during view transitions
  if (!window.__posthog_initialized) {
    window.__posthog_initialized = true;
    !function(t,e){...}(document,window.posthog||[]);
    posthog.init('<ph_project_api_key>', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2025-11-30',
      // IMPORTANT: Use 'history_change' for automatic pageview tracking during soft navigation
      capture_pageview: 'history_change'
    })
  }
</script>
```

Without this guard, ClientRouter's soft navigation can re-execute the inline script during page transitions, causing a stack overflow error.

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

When using View Transitions, you need to set up event listeners after each page navigation:

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

After a successful "login", the app identifies the user and captures a login event:

```javascript
window.posthog?.identify(username);
window.posthog?.capture("user_logged_in");
```

### Event tracking (`src/pages/burrito.astro`)

The burrito page tracks a custom event when a user "considers" the burrito:

```javascript
window.posthog?.capture("burrito_considered", {
  total_considerations: newCount,
  username: currentUser,
});
```

### Logout and session reset (`src/components/Header.astro`)

On logout, both the local auth state and PostHog state are cleared:

```javascript
window.posthog?.capture("user_logged_out");
localStorage.removeItem("currentUser");
window.posthog?.reset();
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

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Astro guide](https://posthog.com/docs/libraries/astro)
- [Astro View Transitions](https://docs.astro.build/en/guides/view-transitions/)
- [Astro documentation](https://docs.astro.build/)
