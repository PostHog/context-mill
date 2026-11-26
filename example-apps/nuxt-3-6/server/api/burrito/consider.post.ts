import { users, incrementBurritoConsiderations } from '~/server/utils/users'
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
  const { username } = body || {}
  const trimmedUsername = typeof username === 'string' ? username.trim() : ''

  if (!trimmedUsername) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username required',
    })
  }

  if (!users.has(trimmedUsername)) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  // Increment burrito considerations (fake, in-memory)
  const user = incrementBurritoConsiderations(trimmedUsername)

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
          event: 'burrito_considered',
          distinctId,
          properties: {
            $session_id: sessionId || undefined,
            total_considerations: user.burritoConsiderations,
            source: 'api',
          },
        })
      },
    )

    // Flush queued events in this short-lived handler and ignore delivery errors so the request never stalls or fails.
    await posthog.flush().catch(() => {})
  }

  return {
    success: true,
    user: { ...user },
  }
})
