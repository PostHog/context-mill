import type { Route } from "./+types/api.burrito.consider";
import { users } from "./api.auth.login";
import { incrementBurritoConsiderations } from "../lib/db";
import type { PostHogContext } from "../lib/posthog-middleware";

export async function action({ request, context }: Route.ActionArgs) {
  const body = await request.json();
  const { username } = body;

  if (!username) {
    return Response.json({ error: 'Username required' }, { status: 400 });
  }

  const user = users.get(username);
  
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const burritoConsiderations = await incrementBurritoConsiderations(username);

  const posthog = (context as PostHogContext).posthog;
  posthog?.capture({ event: 'burrito_considered' });
  
  return Response.json({ 
    success: true, 
    user: { ...user, burritoConsiderations } 
  });
}

