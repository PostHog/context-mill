import { useServerPostHog } from '../../utils/posthog'
import { getOrCreateUser, users } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const { username, password } = body || {}

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password required',
    })
  }

  const user = getOrCreateUser(username)
  const isNewUser = !users.has(username)

  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  // Capture server-side login event
  const posthog = useServerPostHog()
  
  posthog.capture({
    distinctId: distinctId,
    event: 'server_login',
    properties: {
      $session_id: sessionId,
      username: username,
      isNewUser: isNewUser,
      source: 'api',
    },
  })

  return {
    success: true,
    user,
  }
})
