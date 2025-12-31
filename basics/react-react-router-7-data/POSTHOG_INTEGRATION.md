# PostHog Integration

This document outlines all PostHog integrations in the React Router 7 Data Mode example application.

## Table of Contents

- [Dependencies](#dependencies)
- [Client-Side Initialization](#client-side-initialization)
- [Client-Side Integrations](#client-side-integrations)
- [Configuration](#configuration)

---

## Dependencies

**Note:** This project uses PostHog packages, but they should be added to `package.json`. The following packages are used:

- `@posthog/react` - React hooks and provider for PostHog
- `posthog-js` - Client-side PostHog JavaScript SDK

**To install:**
```bash
npm install @posthog/react posthog-js
```

---

## Client-Side Initialization

### Entry Point Setup

**File:** `index.tsx`

PostHog is initialized when the app starts:

```typescript
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2025-11-30',
});

<PostHogProvider client={posthog}>
  <RouterProvider router={router} />
</PostHogProvider>
```

**Key Points:**
- Initializes PostHog with API key and host from environment variables
- Wraps the router with `PostHogProvider` to make PostHog available via React hooks
- This is a client-side only application (no SSR), so PostHog is initialized once at app startup

---

## Client-Side Integrations

### 1. Authentication Context

**File:** `app/contexts/AuthContext.tsx`

Tracks user authentication events:

- **User Identification** (line 53):
  ```typescript
  posthog.identify(username);
  ```
  - Called when user successfully logs in
  - Uses username as the distinct ID

- **Login Event** (line 54):
  ```typescript
  posthog.capture('user_logged_in');
  ```
  - Captures a login event when authentication succeeds

**Note:** This is a client-side only app, so all PostHog calls happen in the browser.

---

### 2. Header Component

**File:** `app/components/Header.tsx`

Handles logout and resets PostHog state:

- **Logout Event** (line 10):
  ```typescript
  posthog?.capture('user_logged_out');
  ```
  - Captures a logout event when user logs out

- **Reset User** (line 11):
  ```typescript
  posthog?.reset();
  ```
  - Resets PostHog state when user logs out
  - Clears user identification

---

### 3. Burrito Page

**File:** `app/routes/burrito.tsx`

Tracks burrito consideration events:

- **Burrito Consideration Event**:
  ```typescript
  posthog?.capture('burrito_considered', {
    total_considerations: updatedUser.burritoConsiderations,
    username: user.username,
  });
  ```
  - Captures a `burrito_considered` event when user considers a burrito
  - Includes total considerations count and username as properties

---

### 4. Profile Page

**File:** `app/routes/profile.tsx`

Includes a test error tracking feature:

- **Error Capture**:
  ```typescript
  posthog?.captureException(err);
  ```
  - Used in a test button to demonstrate error tracking
  - Manually throws and captures an error for testing purposes

---

### 5. Error Boundary

**File:** `app/root.tsx` (RootErrorBoundary component, line 21-23)

Captures unhandled errors:

```typescript
const posthog = usePostHog();
if (error) {
  posthog.captureException(error);
}
```

**Key Points:**
- Captures errors that bubble up to the React Router error boundary
- Uses `usePostHog()` hook to access the PostHog client
- Errors are automatically sent to PostHog for tracking

---

## Configuration

### Environment Variables

Required environment variables (set in `.env` file or build environment):

- `VITE_PUBLIC_POSTHOG_KEY` - PostHog project API key
- `VITE_PUBLIC_POSTHOG_HOST` - PostHog instance host (e.g., `https://us.i.posthog.com`)

### Vite Configuration

**File:** `vite.config.ts`

No special PostHog configuration is needed for this client-side only application. The standard Vite configuration is sufficient.

---

## Event Summary

### Client-Side Events

| Event Name | Location | Description |
|------------|----------|-------------|
| `user_logged_in` | `AuthContext.tsx` | Fired when user successfully logs in (includes user identification) |
| `user_logged_out` | `Header.tsx` | Fired when user logs out |
| `burrito_considered` | `burrito.tsx` | Fired when user considers a burrito (includes total considerations and username) |
| Error exceptions | `root.tsx` (RootErrorBoundary) | Captures unhandled React errors |
| Error exceptions | `profile.tsx` | Test error tracking feature |

---