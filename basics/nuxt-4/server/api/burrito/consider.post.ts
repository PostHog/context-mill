import { useServerPostHog } from '../../utils/posthog'
import { users, incrementBurritoConsiderations } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string }>(event)
  const username = body?.username

  if (!username) {
    throw createError({
      statusCode: 400,
      message: 'Username required',
    })
  }

  if (!users.has(username)) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Increment burrito considerations (fake, in-memory)
  const user = incrementBurritoConsiderations(username)

  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  // Capture server-side burrito consideration event
  const posthog = useServerPostHog()
  
  posthog.capture({
    distinctId: distinctId,
    event: 'burrito_considered',
    properties: {
      $session_id: sessionId,
      username: username,
      total_considerations: user.burritoConsiderations,
      source: 'api',
    },
  })

  return {
    success: true,
    user: { ...user },
  }
})
