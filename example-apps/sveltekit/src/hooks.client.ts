import posthog from 'posthog-js';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';

// Initialize PostHog when the app starts in the browser
export async function init() {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
	// Leave the client uninitialized when the token is missing instead of passing an empty or placeholder key.
	if (!token) {
		if (dev) {
			console.error('PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
		}
		return;
	}

	posthog.init(token, {
		api_host: '/ingest',
		ui_host: env.PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
		defaults: '2026-08-30',
		capture_exceptions: true,
		tracing_headers: [window.location.hostname]
	});
}

// Capture client-side errors with PostHog
export const handleError: HandleClientError = async ({ error, status, message }) => {
	if (env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()) {
		posthog.captureException(error);
	}

	return {
		message,
		status
	};
};
