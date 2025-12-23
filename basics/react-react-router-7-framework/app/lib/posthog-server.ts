import { PostHog } from "posthog-node";

export async function withPostHog<T>(
  request: Request,
  handler: (posthog: PostHog) => Promise<T>
): Promise<T> {
  const posthog = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY!, {
    host: process.env.VITE_PUBLIC_POSTHOG_HOST!,
    flushAt: 1,
    flushInterval: 0,
  });

  const sessionId = request.headers.get('X-POSTHOG-SESSION-ID');
  const distinctId = request.headers.get('X-POSTHOG-DISTINCT-ID');

  console.log('sessionId', sessionId);
  console.log('distinctId', distinctId);
  
  try {
    return await posthog.withContext(
      { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
      async () => {
        return await handler(posthog);
      }
    );
  } catch (error) {
    posthog.captureException(error);
    throw error;
  } finally {
    await posthog.shutdown().catch(console.error);
  }
}

