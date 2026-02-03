import { useServerPostHog } from '../../utils/posthog'

const users = new Map<string, { username: string; burritoConsiderations: number }>()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password required',
    })
  }

  let user = users.get(username)
  const isNewUser = !user

  if (!user) {
    user = { username, burritoConsiderations: 0 }
    users.set(username, user)
  }

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
