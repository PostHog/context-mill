import type { APIRoute } from "astro";
import { getPostHogServer } from "../../../lib/posthog-server";

// In-memory user store for demo purposes
const users = new Map<string, { username: string; createdAt: string }>();

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
        username,
        createdAt: new Date().toISOString(),
      });
    }

    // Get the PostHog server client
    const posthog = getPostHogServer();

    // Get session ID from client if available (passed via header)
    const sessionId = request.headers.get("X-PostHog-Session-Id");

    // Capture server-side login event
    posthog.capture({
      distinctId: username,
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
      distinctId: username,
      properties: {
        username,
        createdAt: isNewUser ? new Date().toISOString() : undefined,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
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
