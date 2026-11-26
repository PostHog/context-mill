import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPostHogClient } from '$lib/server/posthog';

const users = new Map<string, { id: string; username: string; burritoConsiderations: number }>();

export const POST: RequestHandler = async ({ request }) => {
	const { username, password } = await request.json();
	const trimmedUsername = typeof username === 'string' ? username.trim() : '';

	// Reject empty credentials early so login never creates or tracks a blank user identity.
	if (!trimmedUsername || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}

	let user = users.get(trimmedUsername);
	const isNewUser = !user;

	if (!user) {
		user = { id: crypto.randomUUID(), username: trimmedUsername, burritoConsiderations: 0 };
		users.set(trimmedUsername, user);
	}

	const sessionId = request.headers.get('x-posthog-session-id')?.trim();
	const posthog = getPostHogClient();

	// Only capture when PostHog is configured and a stable user ID exists, keeping PII out of event properties.
	if (posthog && user.id) {
		posthog.withContext(
			{
				distinctId: user.id,
				sessionId: sessionId || undefined
			},
			() => {
				posthog.capture({
					event: 'server_login',
					properties: {
						isNewUser,
						source: 'api'
					}
				});
			}
		);

		// Flush queued events in this short-lived handler and ignore delivery errors so login still succeeds.
		await posthog.flush().catch(() => {});
	}

	return json({ success: true, user });
};
