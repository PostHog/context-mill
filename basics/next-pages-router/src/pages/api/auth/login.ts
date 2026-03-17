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

  // Extract distinct_id from PostHog cookie for proper user attribution
  let distinctId = username;
  const phCookieName = Object.keys(req.cookies || {}).find(
    name => name.startsWith('ph_') && name.endsWith('_posthog')
  );
  if (phCookieName && req.cookies[phCookieName]) {
    try {
      const parsed = JSON.parse(req.cookies[phCookieName]);
      if (parsed.distinct_id) {
        distinctId = parsed.distinct_id;
      }
    } catch {}
  }

  // Capture server-side login event with person properties
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId,
    event: 'server_login',
    properties: {
      isNewUser: isNewUser,
      source: 'api',
      $set: { username: username },
      $set_once: { createdAt: new Date().toISOString() },
    }
  });

  return res.status(200).json({ success: true, user });
}
