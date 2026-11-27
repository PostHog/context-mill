import { NextResponse } from 'next/server';
import { getPostHogClient } from '@/lib/posthog-server';

const users = new Map<string, { id: string; username: string; burritoConsiderations: number }>();

export async function POST(request: Request) {
  const body = await request.json();
  const username = typeof body?.username === 'string' ? body.username.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  // Reject missing credentials early so we never capture or identify with a fallback distinctId.
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
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

  // Route handlers are short-lived, so flush queued events and swallow transport errors so PostHog outages never fail login.
  await posthog?.flush().catch(() => {});

  return NextResponse.json({ success: true, user });
}
