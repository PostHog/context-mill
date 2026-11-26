import type { APIRoute } from "astro";
import { getPostHogServer } from "../../../lib/posthog-server";

export const prerender = false;

// In-memory user store for demo purposes
const users = new Map<string, { id: string; username: string; createdAt: string }>();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: "Username and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check if this is a new user
    const isNewUser = !users.has(username);

    if (isNewUser) {
      users.set(username, {
        id: crypto.randomUUID(),
        username,
        createdAt: new Date().toISOString(),
      });
    }

    const user = users.get(username)!;

    // Get the PostHog server client
    const posthog = getPostHogServer();

    // Get session ID from client if available (passed via header)
    const sessionId = request.headers.get("X-PostHog-Session-Id");

    // Capture server-side login event
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

    // Also identify the user server-side
    posthog.identify({
      distinctId: user.id,
      properties: {
        username,
        createdAt: isNewUser ? new Date().toISOString() : undefined,
      },
    });

    // This endpoint is short-lived; flush so the enqueued events send before it returns
    await posthog.flush();

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.id,
        username,
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
