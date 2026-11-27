import { useServerPostHog } from '../../utils/posthog'
import { users, incrementBurritoConsiderations } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string }>(event)
  const trimmedUsername = typeof body?.username === 'string' ? body.username.trim() : ''

  if (!trimmedUsername) {
    throw createError({
      statusCode: 400,
      message: 'Username required',
    })
  }

  if (!users.has(trimmedUsername)) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Increment burrito considerations (fake, in-memory)
  const user = incrementBurritoConsiderations(trimmedUsername)

  const sessionId = getHeader(event, 'x-posthog-session-id')?.trim()
  const distinctId = getHeader(event, 'x-posthog-distinct-id')?.trim()
  const posthog = useServerPostHog()

  // Only capture when x-posthog-distinct-id is present, never falling back to user.id when tracing headers are absent.
  if (posthog && distinctId) {
    posthog.capture({
      distinctId,
      event: 'burrito_considered',
      properties: {
        $session_id: sessionId || undefined,
        total_considerations: user.burritoConsiderations,
        source: 'api',
      },
    })

    // Flush queued events in this short-lived handler and ignore delivery errors so the request never stalls or fails.
    await posthog.flush().catch(() => {})
  }

  return {
    success: true,
    user: { ...user },
  }
})
