import { PostHog } from "posthog-node";
import type { Route } from "../+types/root";

export const posthogMiddleware: Route.MiddlewareFunction = async ({ request, context }: { request: Request; context: any }, next: () => Promise<Response>) => {
  const posthog = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY!, {
    host: process.env.VITE_PUBLIC_POSTHOG_HOST!,
    flushAt: 1,
    flushInterval: 0,
  });

  const sessionId = request.headers.get('X-POSTHOG-SESSION-ID');
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID');

  context.posthog = posthog;

  const response = await posthog.withContext(
    { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
    next
  );

  await posthog.shutdown().catch(() => {});

  return response;
};

