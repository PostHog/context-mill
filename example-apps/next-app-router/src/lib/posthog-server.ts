import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;
let hasWarnedMissingToken = false;

export function getPostHogClient(): PostHog | null {
  // Leave missing tokens unset and return null rather than constructing a PostHog client with a placeholder key.
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  if (!token) {
    if (!hasWarnedMissingToken && process.env.NODE_ENV !== 'production') {
      hasWarnedMissingToken = true;
      console.warn(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured'
      );
    }
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    });
    if (process.env.NODE_ENV === 'development') {
      posthogClient.debug(true);
    }
  }

  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
