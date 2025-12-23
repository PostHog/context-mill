import type { Route } from "./+types/api.burrito.consider";
import { users } from "./api.auth.login";
import { withPostHog } from "../lib/posthog-server";
import { incrementBurritoConsiderations } from "../lib/db";

export async function action({ request }: Route.ActionArgs) {
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

  return withPostHog(request, async (posthog) => {
    posthog.capture({
      distinctId: username,
      event: 'burrito_considered',
      properties: {
        total_considerations: burritoConsiderations,
        username: username,
      },
    });

    return Response.json({ 
      success: true, 
      user: { ...user, burritoConsiderations } 
    });
  });
}

