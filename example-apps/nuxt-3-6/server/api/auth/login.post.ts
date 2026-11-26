import { getOrCreateUser, users } from '~/server/utils/users'
import { useServerPostHog } from '~/server/utils/posthog'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  }

  const body = await readBody(event)
  const { username, password } = body || {}
  const trimmedUsername = typeof username === 'string' ? username.trim() : ''

  // Reject missing credentials early so login never creates or tracks a blank user identity.
  if (!trimmedUsername || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password required',
    })
  }

  const isNewUser = !users.has(trimmedUsername)
  const user = getOrCreateUser(trimmedUsername)

  // Read tracing headers forwarded automatically from posthog-js.
  const sessionId = getHeader(event, 'x-posthog-session-id')?.trim()
  const distinctId = getHeader(event, 'x-posthog-distinct-id')?.trim()
  const posthog = useServerPostHog()

  // Only capture when x-posthog-distinct-id is present, never falling back to user.id or a shared anonymous string.
  if (posthog && distinctId) {
    await posthog.withContext(
      { sessionId: sessionId || undefined, distinctId },
      async () => {
        posthog.capture({
          event: 'server_login',
          distinctId,
          properties: {
            $session_id: sessionId || undefined,
            is_new_user: isNewUser,
            source: 'api',
          },
        })
      },
    )

    // Flush queued events in this short-lived handler and ignore delivery errors so login still succeeds.
    await posthog.flush().catch(() => {})
  }

  return {
    success: true,
    user: { ...user },
  }
})
