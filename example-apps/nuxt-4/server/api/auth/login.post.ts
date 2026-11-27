import { useServerPostHog } from '../../utils/posthog'
import { getOrCreateUser, users } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const { username, password } = body || {}
  const trimmedUsername = typeof username === 'string' ? username.trim() : ''

  // Reject missing credentials early so login never creates or tracks a blank user identity.
  if (!trimmedUsername || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password required',
    })
  }

  const isNewUser = !users.has(trimmedUsername)
  const user = getOrCreateUser(trimmedUsername)

  const sessionId = getHeader(event, 'x-posthog-session-id')?.trim()
  const distinctId = getHeader(event, 'x-posthog-distinct-id')?.trim()
  const posthog = useServerPostHog()

  // Only capture when x-posthog-distinct-id is present, never falling back to user.id when tracing headers are absent.
  if (posthog && distinctId) {
    posthog.capture({
      distinctId,
      event: 'server_login',
      properties: {
        $session_id: sessionId || undefined,
        isNewUser,
        source: 'api',
      },
    })

    // Flush queued events in this short-lived handler and ignore delivery errors so login still succeeds.
    await posthog.flush().catch(() => {})
  }

  return {
    success: true,
    user,
  }
})
