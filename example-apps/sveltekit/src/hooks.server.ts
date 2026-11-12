import type { Handle, HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { getPostHogClient } from '$lib/server/posthog';

// Handle requests - includes reverse proxy for PostHog
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Reverse proxy for PostHog - route /ingest requests to PostHog servers
	if (pathname.startsWith('/ingest')) {
		const useAssetHost = pathname.startsWith('/ingest/static/') || pathname.startsWith('/ingest/array/');
		// Proxy to the region in PUBLIC_POSTHOG_HOST: us.i.posthog.com or eu.i.posthog.com
		const apiHostname = new URL(env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').hostname;
		const hostname = useAssetHost ? apiHostname.replace('.i.posthog.com', '-assets.i.posthog.com') : apiHostname;

		const url = new URL(event.request.url);
		url.protocol = 'https:';
		url.hostname = hostname;
		url.port = '443';
		url.pathname = pathname.replace(/^\/ingest/, '');

		const headers = new Headers(event.request.headers);
		headers.set('host', hostname);
		// Remove cookies before forwarding to PostHog
		headers.delete('cookie');
		// Forward PostHog keys (Bearer phc_, phs_ or phx_), which the SDKs need. Strip any other credentials.
		if (!/^Bearer ph[csx]_/.test(headers.get('authorization') ?? '')) {
			headers.delete('authorization');
		}
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

	posthog?.capture({
		distinctId: 'server',
		event: 'server_error',
		properties: {
			error: error instanceof Error ? error.message : String(error),
			status,
			message
		}
	});

	// handleError runs per request; flush so the enqueued event sends before it returns
	await posthog?.flush();

	return {
		message,
		status
	};
};
