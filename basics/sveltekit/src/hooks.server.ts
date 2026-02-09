import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getPostHogClient } from '$lib/server/posthog';

// Handle requests - includes reverse proxy for PostHog
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Reverse proxy for PostHog - route /ingest requests to PostHog servers
	if (pathname.startsWith('/ingest')) {
		const hostname = pathname.startsWith('/ingest/static/')
			? 'us-assets.i.posthog.com'
			: 'us.i.posthog.com';

		const url = new URL(event.request.url);
		url.protocol = 'https:';
		url.hostname = hostname;
		url.port = '443';
		url.pathname = pathname.replace(/^\/ingest/, '');

		const headers = new Headers(event.request.headers);
		headers.set('host', hostname);
		headers.set('accept-encoding', '');

		const clientIp = event.request.headers.get('x-forwarded-for') || event.getClientAddress();
		if (clientIp) {
			headers.set('x-forwarded-for', clientIp);
		}

		const response = await fetch(url.toString(), {
			method: event.request.method,
			headers,
			body: event.request.body,
			// @ts-expect-error - duplex is required for streaming request bodies
			duplex: 'half'
		});

		return response;
	}

	return resolve(event);
};

// Capture server-side errors with PostHog
export const handleError: HandleServerError = async ({ error, status, message }) => {
	const posthog = getPostHogClient();

	posthog.capture({
		distinctId: 'server',
		event: 'server_error',
		properties: {
			error: error instanceof Error ? error.message : String(error),
			status,
			message
		}
	});

	return {
		message,
		status
	};
};
