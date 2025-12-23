import type { Route } from "./+types/api.auth.login";
import { withPostHog } from "../lib/posthog-server";
import { getBurritoConsiderations } from "../lib/db";

const users = new Map<string, { username: string }>();

export { users };

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  const { username, password } = body;

  if (!username || !password) {
    return Response.json({ error: 'Username and password required' }, { status: 400 });
  }

  let user = users.get(username);
  
  if (!user) {
    user = { username };
    users.set(username, user);
  }

  const burritoConsiderations = await getBurritoConsiderations(username);

  return withPostHog(request, async (posthog) => {
    posthog.capture({
      distinctId: username,
      event: 'server_login',
    });

    return Response.json({ 
      success: true, 
      user: { ...user, burritoConsiderations } 
    });
  });
}
