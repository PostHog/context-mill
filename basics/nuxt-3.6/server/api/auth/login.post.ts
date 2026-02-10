import { getOrCreateUser } from '~/server/utils/users'
import { PostHog } from 'posthog-node'
import { useRuntimeConfig } from '#imports'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  if (event.node.req.method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed'
    })
  }

  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password required'
    })
  }

  // Fake auth - just get or create user
  const user = getOrCreateUser(username)

  const runtimeConfig = useRuntimeConfig()

    // Relies on __add_tracing_headers being set in the client-side SDK
  const sessionId = getHeader(event, 'x-posthog-session-id')
  const distinctId = getHeader(event, 'x-posthog-distinct-id')

  const posthog = new PostHog(
    runtimeConfig.public.posthog.publicKey,
    { 
      host: runtimeConfig.public.posthog.host, 
    }
  )

  await posthog.withContext(
    { sessionId: sessionId ?? undefined, distinctId: distinctId ?? undefined },
    async () => {
      posthog.capture({
        event: 'server_login',
        distinctId: distinctId ?? username,
      })
    }
  )

  // Always shutdown to ensure all events are flushed
  await posthog.shutdown()

  return {
    success: true,
    user: { ...user }
  }
})
