import { PostHog } from 'posthog-node';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
	if (!token) {
		if (dev) {
			console.warn('PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Server-side PostHog is disabled.');
		}
		return null;
	}
	if (!posthogClient) {
		posthogClient = new PostHog(token, {
			host: env.PUBLIC_POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0
		});
	}
	return posthogClient;
}

export async function shutdownPostHog() {
	if (posthogClient) {
		await posthogClient.shutdown();
	}
}
