const TOKEN = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
// posthog-js defaults. Change SESSION_IDLE_MS if you set session_idle_timeout_seconds.
const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_MAX_MS = 24 * 60 * 60 * 1000;

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
}

function fromCookie(request: Request): { distinctId?: string; sessionId?: string } {
  const raw = readCookie(request, `ph_${TOKEN}_posthog`);
  if (!raw) return {};
  try {
    const state = JSON.parse(decodeURIComponent(raw));
    const [lastActivity, sessionId, sessionStart = lastActivity] = Array.isArray(state.$sesid) ? state.$sesid : [];
    const now = Date.now();
    const active = Math.abs(now - lastActivity) < SESSION_IDLE_MS && Math.abs(now - sessionStart) < SESSION_MAX_MS;
    return { distinctId: state.distinct_id, sessionId: active ? sessionId : undefined };
  } catch {
    return {};
  }
}

function visitor(request: Request): { distinctId?: string; $session_id?: string; $user_agent?: string } {
  // Visitors who opted out are not linked
  if (readCookie(request, `__ph_opt_in_out_${TOKEN}`) === "0") return {};
  const header = (name: string) => request.headers.get(name)?.trim() || undefined;
  const cookie = fromCookie(request);
  const distinctId = header("x-posthog-distinct-id") ?? cookie.distinctId;
  return {
    distinctId: distinctId === "$posthog_cookieless" ? undefined : distinctId,
    $session_id: header("x-posthog-session-id") ?? cookie.sessionId,
    $user_agent: request.headers.get("user-agent") ?? undefined,
  };
}

// For captureException only: it includes anonymous visitors, which exceptions never turn into
// person profiles. Never use these IDs to authorize anything.
export function posthogExceptionContext(request: Request) {
  const url = new URL(request.url);
  // Client navigations request /page.data, and /_root.data (React Router 7) or /_.data (React Router 8)
  // for the home page: report the page
  const path = url.pathname.replace(/\/_(root)?\.data$/, "/").replace(/\.data$/, "");
  const { distinctId, ...properties } = visitor(request);
  return {
    distinctId,
    properties: { ...properties, $current_url: url.origin + path, $request_method: request.method, $request_path: path },
  };
}
