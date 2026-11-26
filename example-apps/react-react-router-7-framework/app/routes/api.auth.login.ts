import type { Route } from "./+types/api.auth.login";
import { getBurritoConsiderations } from "../lib/db";
import type { PostHogContext } from "../lib/posthog-middleware";

export interface StoredUser {
  id: string;
  username: string;
}

const users = new Map<string, StoredUser>();

export { users };

export async function action({ request, context }: Route.ActionArgs) {
  const body = await request.json();
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  // Reject blank credentials before creating a user or capturing analytics events.
  if (!username || !password) {
    return Response.json({ error: "Username and password required" }, { status: 400 });
  }

  let user = users.get(username);

  if (!user) {
    user = { id: crypto.randomUUID(), username };
    users.set(username, user);
  }

  const { posthog, distinctId } = context as PostHogContext;
  // Only capture when a non-empty x-posthog-distinct-id header is present.
  // When identity is missing, skip capture instead of passing undefined or a fallback string.
  if (posthog && distinctId) {
    posthog.capture({ distinctId, event: "server_login" });
    await posthog.flush().catch(() => {});
  }

  const burritoConsiderations = await getBurritoConsiderations(username);

  return Response.json({
    success: true,
    user: { ...user, burritoConsiderations },
  });
}
