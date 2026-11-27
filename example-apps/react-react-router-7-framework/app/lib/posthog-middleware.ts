import type { RouterContextProvider } from "react-router";
import type { PostHog } from "posthog-node";
import type { Route } from "../+types/root";
import { posthog } from "./posthog.server";

export interface PostHogContext extends RouterContextProvider {
  posthog?: PostHog;
  distinctId?: string;
}

// Propagate the browser's PostHog distinctId and sessionId from tracing headers.
// Leave distinctId undefined when the header is missing rather than inventing a fallback ID.
export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  if (!posthog) {
    return next();
  }

  const distinctId = request.headers.get("x-posthog-distinct-id")?.trim() || undefined;
  const sessionId = request.headers.get("x-posthog-session-id")?.trim() || undefined;

  const posthogContext = context as PostHogContext;
  posthogContext.posthog = posthog;
  posthogContext.distinctId = distinctId;

  if (!distinctId && !sessionId) {
    return next();
  }

  return posthog.withContext(
    {
      ...(distinctId ? { distinctId } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    next,
    { fresh: true },
  );
};
