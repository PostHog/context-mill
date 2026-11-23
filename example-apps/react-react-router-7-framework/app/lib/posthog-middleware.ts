import type { RouterContextProvider } from "react-router";
import type { PostHog } from "posthog-node";
import type { Route } from "../+types/root";
import { posthog } from "./posthog.server";
import { posthogRequestContext } from "./posthog-request.server";

export interface PostHogContext extends RouterContextProvider {
  posthog?: PostHog;
}

export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }, next) => {
  if (!posthog) {
    return next();
  }

  (context as PostHogContext).posthog = posthog;

  const { distinctId, properties } = posthogRequestContext(request);
  return posthog.withContext(
    { distinctId, sessionId: properties.$session_id, properties },
    next,
    { fresh: true },
  );
};
