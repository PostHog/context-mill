import { createReactRouterErrorHandler, PostHog } from "posthog-node";

// Read the project token without a fallback value. Vite inlines VITE_ variables into the
// server build, and when the token is unset we return null rather than using a placeholder key.
const token = (
  import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ||
  process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
)?.trim();

const globalState = globalThis as typeof globalThis & {
  __posthogMissingTokenWarned?: boolean;
};

if (!token && process.env.NODE_ENV !== "production" && !globalState.__posthogMissingTokenWarned) {
  globalState.__posthogMissingTokenWarned = true;
  console.warn(
    "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

const host =
  import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
  process.env.VITE_PUBLIC_POSTHOG_HOST ||
  "https://us.i.posthog.com";

// One singleton client for the server process, configured for short-lived route handlers.
// readPostHogCookie links initial page loads to the browser visitor.
export const posthog = token
  ? new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
      readPostHogCookie: true,
    })
  : null;

// React Router's handleError captures server errors with the visitor's person, session, and page
// URL. Without a configured client, undefined lets React Router's default error handler run.
export const handleError = posthog ? createReactRouterErrorHandler(posthog) : undefined;
