import type { APIRoute } from "astro";
import { getPostHogServer } from "../../../lib/posthog-server";

export const prerender = false;

// In-memory user store for demo purposes
const users = new Map<string, { id: string; username: string; createdAt: string }>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body;
    const trimmedUsername = typeof username === "string" ? username.trim() : "";

    // Reject missing credentials early so login never creates or tracks a blank user identity.
    if (!trimmedUsername || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const isNewUser = !users.has(trimmedUsername);

    if (isNewUser) {
      users.set(trimmedUsername, {
        id: crypto.randomUUID(),
        username: trimmedUsername,
        createdAt: new Date().toISOString(),
      });
    }

    const user = users.get(trimmedUsername);
    const posthog = getPostHogServer();

    // Read PostHog tracing headers forwarded automatically from posthog-js.
    const clientDistinctId = request.headers.get("X-PostHog-Distinct-Id");
    const sessionId = request.headers.get("X-PostHog-Session-Id");

    // Only capture when PostHog is configured and a stable user ID exists, never falling back to a placeholder ID.
    if (posthog && user?.id) {
      posthog.withContext(
        {
          distinctId: clientDistinctId || undefined,
          sessionId: sessionId || undefined,
        },
        () => {
          posthog.capture({
            distinctId: user.id,
            event: "server_login",
            properties: {
              $session_id: sessionId || undefined,
              isNewUser,
              source: "api",
              timestamp: new Date().toISOString(),
            },
          });
        },
      );

      // Flush queued events in this short-lived route handler and ignore delivery errors so login still succeeds.
      await posthog.flush().catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: user?.id,
        username: trimmedUsername,
        isNewUser,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
