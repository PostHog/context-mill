const SESSION_IDLE_MS = 30 * 60 * 1000
const SESSION_MAX_MS = 24 * 60 * 60 * 1000

function fromCookie(request: Request): { distinctId?: string; sessionId?: string } {
  const match = request.headers.get("cookie")?.match(/(?:^|;\s*)ph_[^=]+_posthog=([^;]+)/)
  if (!match) return {}
  try {
    const state = JSON.parse(decodeURIComponent(match[1]))
    const [lastActivity, sessionId, sessionStart] = state.$sesid ?? []
    const now = Date.now()
    const active = now - lastActivity < SESSION_IDLE_MS && now - sessionStart < SESSION_MAX_MS
    return { distinctId: state.distinct_id, sessionId: active ? sessionId : undefined }
  } catch {
    return {}
  }
}

// Analytics context only: never use these IDs to authorize anything.
export function posthogRequestContext(request: Request) {
  const header = (name: string) => request.headers.get(name)?.trim() || undefined
  const cookie = fromCookie(request)
  const distinctId = header("x-posthog-distinct-id") ?? cookie.distinctId
  const url = new URL(request.url)
  return {
    distinctId: distinctId === "$posthog_cookieless" ? undefined : distinctId,
    properties: {
      $session_id: header("x-posthog-session-id") ?? cookie.sessionId,
      $current_url: url.origin + url.pathname,
      $request_method: request.method,
      $request_path: url.pathname,
      $user_agent: request.headers.get("user-agent") ?? undefined,
    },
  }
}
