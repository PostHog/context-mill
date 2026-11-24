import { PostHog } from "posthog-node";

// Vite inlines VITE_ variables into the server build too, so the server gets the browser's values
// without reading .env at run time (react-router-serve does not load it).
const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (!token) {
  console.warn("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN was not set at build time. Server-side PostHog is disabled.");
}

// One client for the server process. Exception autocapture covers errors no request handles.
export const posthog = token
  ? new PostHog(token, {
      host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      enableExceptionAutocapture: true,
    })
  : undefined;
