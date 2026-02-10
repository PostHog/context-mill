# PostHog Astro Static Example

This is an [Astro](https://astro.build/) static site (SSG) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

It uses the PostHog web snippet directly and shows how to:

- Initialize PostHog in a static Astro site using a reusable component
- Identify users after login
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

The PostHog snippet is included as an inline script to prevent Astro from processing it:

```astro
<script is:inline>
  !function(t,e){...}(document,window.posthog||[]);
  posthog.init('<ph_project_api_key>', {
    api_host: 'https://us.i.posthog.com',
    defaults: '2025-11-30'
  })
</script>
```

The `is:inline` directive is required to prevent TypeScript errors about `window.posthog`.

### User identification (`src/pages/index.astro`)

After a successful "login", the app identifies the user and captures a login event:

```javascript
window.posthog?.identify(username);
window.posthog?.capture("user_logged_in");
```

Identification happens **only on login**, all further requests will automatically use the same distinct ID.

### Event tracking (`src/pages/burrito.astro`)

The burrito page tracks a custom event when a user "considers" the burrito:

```javascript
window.posthog?.capture("burrito_considered", {
  total_considerations: newCount,
  username: currentUser,
});
```

This shows how to attach useful properties to events (e.g. counts, usernames).

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

On logout, both the local auth state and PostHog state are cleared:

```javascript
window.posthog?.capture("user_logged_out");
localStorage.removeItem("currentUser");
window.posthog?.reset();
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

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Astro guide](https://posthog.com/docs/libraries/astro)
- [Astro documentation](https://docs.astro.build/)
