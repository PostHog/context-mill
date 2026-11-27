import { PostHog } from "posthog-node";

// Leave missing tokens unset and return null rather than constructing a PostHog client with a placeholder key.
const token = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();

const globalWarnState = globalThis as typeof globalThis & {
  __posthogRemixMissingTokenWarned?: boolean;
};

if (!token && process.env.NODE_ENV !== "production" && !globalWarnState.__posthogRemixMissingTokenWarned) {
  globalWarnState.__posthogRemixMissingTokenWarned = true;
  console.warn(
    "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
  );
}

// One client for the whole process. Remix handlers are short-lived, so send each event straight away.
export const posthog = token
  ? new PostHog(token, {
      host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  : null;

// posthog-js attaches X-POSTHOG-DISTINCT-ID and X-POSTHOG-SESSION-ID to same-origin requests via tracing_headers.
// When an unauthenticated visitor or server error request lacks a distinct id, generate a per-request UUID with process_person_profile set to false instead of a shared literal string.
function identityFrom(request: Request) {
  const distinctId = request.headers.get("X-POSTHOG-DISTINCT-ID")?.trim();
  const sessionId = request.headers.get("X-POSTHOG-SESSION-ID")?.trim();

  if (distinctId) {
    return {
      distinctId,
      properties: {
        ...(sessionId && { $session_id: sessionId }),
      },
      options: {},
    };
  }

  return {
    distinctId: crypto.randomUUID(),
    properties: {
      ...(sessionId && { $session_id: sessionId }),
    },
    options: { process_person_profile: false },
  };
}

export async function captureEvent(
  request: Request,
  event: string,
  properties: Record<string, unknown> = {}
) {
  if (!posthog) return;

  const distinctId = request.headers.get("X-POSTHOG-DISTINCT-ID")?.trim();
  const sessionId = request.headers.get("X-POSTHOG-SESSION-ID")?.trim();
  // Signed-in user action routes require the browser's PostHog distinct id header, so skip capture when it is missing instead of inventing a fallback id.
  if (!distinctId) return;

  posthog.capture({
    distinctId,
    event,
    properties: {
      ...properties,
      ...(sessionId && { $session_id: sessionId }),
    },
  });
  await posthog.flush().catch(() => {});
}

export async function captureError(request: Request, error: unknown) {
  if (!posthog) return;

  const identity = identityFrom(request);
  posthog.captureException(error, {
    distinctId: identity.distinctId,
    properties: identity.properties,
    options: identity.options,
  });
  await posthog.flush().catch(() => {});
}
