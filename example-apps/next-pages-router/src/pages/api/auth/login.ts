import type { NextApiRequest, NextApiResponse } from 'next';
import { getPostHogClient } from '@/lib/posthog-server';

const users = new Map<string, { username: string; burritoConsiderations: number }>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let user = users.get(username);
  const isNewUser = !user;

  if (!user) {
    user = { username, burritoConsiderations: 0 };
    users.set(username, user);
  }

  // Capture server-side login event
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: username,
    event: 'server_login',
    properties: {
      username: username,
      isNewUser: isNewUser,
      source: 'api'
    }
  });

  // Identify user on server side
  posthog.identify({
    distinctId: username,
    properties: {
      username: username,
      createdAt: isNewUser ? new Date().toISOString() : undefined
    }
  });

  return res.status(200).json({ success: true, user });
}
