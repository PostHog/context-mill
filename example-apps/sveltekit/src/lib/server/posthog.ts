import { PostHog } from 'posthog-node';
import { env } from '$env/dynamic/public';

let posthogClient: PostHog | null = null;
let hasWarnedMissingToken = false;

export function getPostHogClient(): PostHog | null {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
	// Return null when the project token is missing instead of constructing a client with an empty or placeholder key.
	if (!token) {
		if (!import.meta.env.PROD && !hasWarnedMissingToken) {
			hasWarnedMissingToken = true;
			console.warn('PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
		}
		return null;
	}

	if (!posthogClient) {
		posthogClient = new PostHog(token, {
			host: env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
			flushAt: 1,
			flushInterval: 0,
			requestTimeout: 2000,
			fetchRetryCount: 0,
			enableExceptionAutocapture: true
		});
	}
	return posthogClient;
}

export async function shutdownPostHog() {
	if (posthogClient) {
		await posthogClient.shutdown(3000);
		posthogClient = null;
	}
}
