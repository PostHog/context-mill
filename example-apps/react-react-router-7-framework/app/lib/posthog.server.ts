import { PostHog } from "posthog-node";

const token = process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (!token && process.env.NODE_ENV === "development") {
  console.warn("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Server-side PostHog is disabled.");
}

// One client for the server process. Exception autocapture covers errors no request handles.
export const posthog = token
  ? new PostHog(token, {
      host: process.env.VITE_PUBLIC_POSTHOG_HOST,
      enableExceptionAutocapture: true,
    })
  : undefined;
