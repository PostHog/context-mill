import { createReactRouterErrorHandler, PostHog } from "posthog-node";

// Vite inlines VITE_ variables into the server build too, so the server gets the browser's values
// without reading .env at run time (react-router-serve does not load it).
const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (!token) {
  console.warn("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN was not set at build time. Server-side PostHog is disabled.");
}

// One client for the server process. Exception autocapture covers errors no request handles.
// readPostHogCookie links page loads, which send only the posthog-js cookie, to the visitor.
export const posthog = token
  ? new PostHog(token, {
      host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      enableExceptionAutocapture: true,
      readPostHogCookie: true,
    })
  : undefined;

// React Router's handleError: captures server errors with the visitor's person, session and page
// URL, and logs them the way React Router does. Without a client, React Router's own handler runs.
export const handleError = posthog ? createReactRouterErrorHandler(posthog) : undefined;
