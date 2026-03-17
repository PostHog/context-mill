import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPostHogClient } from '@/lib/posthog-server';

const users = new Map<string, { username: string; burritoConsiderations: number }>();

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  let user = users.get(username);
  const isNewUser = !user;

  if (!user) {
    user = { username, burritoConsiderations: 0 };
    users.set(username, user);
  }

  // Extract distinct_id from PostHog cookie for proper user attribution
  const cookieStore = await cookies();
  const phCookie = cookieStore.getAll().find(c => c.name.startsWith('ph_') && c.name.endsWith('_posthog'));
  let distinctId = username;
  if (phCookie) {
    try {
      const parsed = JSON.parse(phCookie.value);
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

  return NextResponse.json({ success: true, user });
}