import type { RouterContextProvider } from "react-router";
import type { PostHog } from "posthog-node";
import type { Route } from "../+types/root";
import { posthog } from "./posthog.server";

export interface PostHogContext extends RouterContextProvider {
  posthog?: PostHog;
}

// Server events in this request carry the browser's IDs, which posthog-js sends in the tracing headers.
export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  if (!posthog) {
    return next();
  }

  (context as PostHogContext).posthog = posthog;

  const header = (name: string) => request.headers.get(name)?.trim() || undefined;
  return posthog.withContext(
    { distinctId: header("x-posthog-distinct-id"), sessionId: header("x-posthog-session-id") },
    next,
    { fresh: true },
  );
};
