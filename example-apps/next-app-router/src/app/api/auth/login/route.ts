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

  return NextResponse.json({ success: true, user });
}