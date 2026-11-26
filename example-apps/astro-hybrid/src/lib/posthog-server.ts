import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;
let hasWarnedMissingToken = false;

/**
 * Get the PostHog server-side client.
 * Uses a singleton pattern to avoid creating multiple clients.
 */
export function getPostHogServer(): PostHog | null {
  // Leave the server client uninitialized when the token is unset rather than passing an empty fallback key or disabled flag.
  const token = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!token) {
    if (!import.meta.env.PROD && !hasWarnedMissingToken) {
      hasWarnedMissingToken = true;
      console.warn(
        "PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: import.meta.env.PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    });
  }
  return posthogClient;
}

/**
 * Shutdown the PostHog client gracefully.
 * Call this when your server is shutting down.
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthogClient) {
    await posthogClient.shutdown(3000);
    posthogClient = null;
  }
}
