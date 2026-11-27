import type { NextApiRequest, NextApiResponse } from 'next';
import { getPostHogClient } from '@/lib/posthog-server';

const users = new Map<string, { id: string; username: string; burritoConsiderations: number }>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  // Reject missing credentials early so we never capture or identify with a fallback distinctId.
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let user = users.get(username);
  const isNewUser = !user;

  if (!user) {
    user = { id: crypto.randomUUID(), username, burritoConsiderations: 0 };
    users.set(username, user);
  }

  // Attribute server events to the authenticated user's stable UUID, never a username or literal fallback id.
  const posthog = getPostHogClient();
  posthog?.capture({
    distinctId: user.id,
    event: 'server_login',
    properties: {
      isNewUser: isNewUser,
      source: 'api',
    },
  });

  // Store person attributes like username via identify rather than event properties.
  posthog?.identify({
    distinctId: user.id,
    properties: {
      username: username,
      createdAt: isNewUser ? new Date().toISOString() : undefined,
    },
  });

  // API handlers are short-lived, so flush queued events and swallow transport errors so PostHog outages never fail login.
  await posthog?.flush().catch(() => {});

  return res.status(200).json({ success: true, user });
}
