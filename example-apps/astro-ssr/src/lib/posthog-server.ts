import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

/**
 * Get the PostHog server-side client.
 * Uses a singleton pattern to avoid creating multiple clients.
 */
export function getPostHogServer(): PostHog {
  if (!posthogClient) {
    const token = import.meta.env.POSTHOG_PROJECT_TOKEN;
    if (!token && import.meta.env.DEV) {
      console.warn(
        "POSTHOG_PROJECT_TOKEN is not set. Server-side PostHog capture is disabled.",
      );
    }
    posthogClient = new PostHog(token || "", {
      disabled: !token,
      host: import.meta.env.POSTHOG_HOST || "https://us.i.posthog.com",
      // Flush immediately for demo purposes
      // In production, you might want to batch events
      flushAt: 1,
      flushInterval: 0,
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
    await posthogClient.shutdown();
    posthogClient = null;
  }
}
