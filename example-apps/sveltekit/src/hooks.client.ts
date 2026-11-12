import posthog from 'posthog-js';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';
import type { HandleClientError } from '@sveltejs/kit';

// Initialize PostHog when the app starts in the browser
export async function init() {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN;
	if (!token) {
		if (dev) {
			console.warn('PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.');
		}
		return;
	}

	posthog.init(token, {
		api_host: '/ingest',
		ui_host: env.PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com', // The PostHog app for your region
		defaults: '2026-08-30',
		capture_exceptions: true
	});
}

// Capture client-side errors with PostHog
export const handleError: HandleClientError = async ({ error, status, message }) => {
	posthog.captureException(error);

	return {
		message,
		status
	};
};
