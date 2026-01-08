import type { Route } from "./+types/api.auth.login";
import { getBurritoConsiderations } from "../lib/db";
import type { PostHogContext } from "../lib/posthog-middleware";

const users = new Map<string, { username: string }>();

export { users };

export async function action({ request, context }: Route.ActionArgs) {
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

  const posthog = (context as PostHogContext).posthog;
  if (posthog) {
    posthog.capture({ event: 'server_login' });
  }

  const burritoConsiderations = await getBurritoConsiderations(username);

  return Response.json({ 
    success: true, 
    user: { ...user, burritoConsiderations } 
  });
}
