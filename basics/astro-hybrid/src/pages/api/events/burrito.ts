import type { APIRoute } from "astro";
import { getPostHogServer } from "../../../lib/posthog-server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, totalConsiderations } = body;

    if (!username) {
      return new Response(JSON.stringify({ error: "Username is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the PostHog server client
    const posthog = getPostHogServer();

    // Get session ID from client if available (passed via header)
    const sessionId = request.headers.get("X-PostHog-Session-Id");

    // Capture server-side burrito consideration event
    posthog.capture({
      distinctId: username,
      event: "burrito_considered",
      properties: {
        $session_id: sessionId || undefined,
        total_considerations: totalConsiderations,
        source: "api",
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalConsiderations,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Burrito event error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
