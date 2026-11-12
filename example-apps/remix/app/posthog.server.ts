import { PostHog } from "posthog-node";

const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (!token && process.env.NODE_ENV !== "production") {
  console.warn(
    "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
  );
}

// One client for the whole process. Remix handlers are short-lived, so send each event straight away.
export const posthog = token
  ? new PostHog(token, {
      host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  : null;

// posthog-js adds these headers to same-origin requests because of `tracing_headers`.
// Without them the visitor is anonymous: use a random id and skip creating a person profile.
function identityFrom(request: Request) {
  const distinctId = request.headers.get("X-POSTHOG-DISTINCT-ID");
  const sessionId = request.headers.get("X-POSTHOG-SESSION-ID");

  return {
    distinctId: distinctId ?? crypto.randomUUID(),
    properties: {
      ...(sessionId && { $session_id: sessionId }),
      ...(!distinctId && { $process_person_profile: false }),
    },
  };
}

export async function captureEvent(
  request: Request,
  event: string,
  properties: Record<string, unknown> = {}
) {
  if (!posthog) return;

  const identity = identityFrom(request);
  posthog.capture({
    distinctId: identity.distinctId,
    event,
    properties: { ...properties, ...identity.properties },
  });
  await posthog.flush().catch(() => {});
}

export async function captureError(request: Request, error: unknown) {
  if (!posthog) return;

  const identity = identityFrom(request);
  posthog.captureException(error, identity.distinctId, identity.properties);
  await posthog.flush().catch(() => {});
}
