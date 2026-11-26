import type { APIRoute } from "astro";
import { getPostHogServer } from "../../../lib/posthog-server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, totalConsiderations } = body;
    const trimmedUserId = typeof userId === "string" ? userId.trim() : "";

    // Require an authenticated user ID instead of falling back to an anonymous or shared distinctId.
    if (!trimmedUserId) {
      return new Response(JSON.stringify({ error: "User id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const posthog = getPostHogServer();

    // Read PostHog tracing headers forwarded automatically from posthog-js.
    const clientDistinctId = request.headers.get("X-PostHog-Distinct-Id");
    const sessionId = request.headers.get("X-PostHog-Session-Id");

    // Skip server capture when PostHog is unconfigured or user identity is absent.
    if (posthog && trimmedUserId) {
      posthog.withContext(
        {
          distinctId: clientDistinctId || undefined,
          sessionId: sessionId || undefined,
        },
        () => {
          posthog.capture({
            distinctId: trimmedUserId,
            event: "burrito_considered",
            properties: {
              $session_id: sessionId || undefined,
              total_considerations: totalConsiderations,
              source: "api",
              timestamp: new Date().toISOString(),
            },
          });
        },
      );

      // Flush queued events in this short-lived route handler and ignore delivery errors so the response never stalls or fails.
      await posthog.flush().catch(() => {});
    }

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
