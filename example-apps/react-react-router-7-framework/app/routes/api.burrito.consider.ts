import type { Route } from "./+types/api.burrito.consider";
import { users } from "./api.auth.login";
import { incrementBurritoConsiderations } from "../lib/db";
import type { PostHogContext } from "../lib/posthog-middleware";

export async function action({ request, context }: Route.ActionArgs) {
  const body = await request.json();
  const username = typeof body?.username === "string" ? body.username.trim() : "";

  // Reject blank usernames before mutating state or capturing analytics events.
  if (!username) {
    return Response.json({ error: "Username required" }, { status: 400 });
  }

  const user = users.get(username);

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const burritoConsiderations = await incrementBurritoConsiderations(username);

  const { posthog, distinctId } = context as PostHogContext;
  // Only capture when a non-empty x-posthog-distinct-id header is present.
  // When identity is missing, skip capture instead of passing undefined or a fallback string.
  if (posthog && distinctId) {
    posthog.capture({
      distinctId,
      event: "burrito_considered",
      properties: { total_considerations: burritoConsiderations },
    });
    await posthog.flush().catch(() => {});
  }

  return Response.json({
    success: true,
    user: { ...user, burritoConsiderations },
  });
}
