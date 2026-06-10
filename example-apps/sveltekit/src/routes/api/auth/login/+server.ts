import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPostHogClient } from '$lib/server/posthog';

const users = new Map<string, { username: string; burritoConsiderations: number }>();

export const POST: RequestHandler = async ({ request }) => {
	const { username, password } = await request.json();

	if (!username || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}

	let user = users.get(username);
	const isNewUser = !user;

	if (!user) {
		user = { username, burritoConsiderations: 0 };
		users.set(username, user);
	}

	// Capture server-side login event with user context
	const posthog = getPostHogClient();
	posthog.withContext(
		{
			distinctId: username,
			personProperties: {
				username,
				createdAt: isNewUser ? new Date().toISOString() : undefined
			}
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

	// Flush events to ensure they're sent
	await posthog.flush();

	return json({ success: true, user });
};
