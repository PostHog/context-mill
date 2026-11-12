import { randomUUID } from 'node:crypto'
import fp from 'fastify-plugin'
import { PostHog } from 'posthog-node'

declare module 'fastify' {
  interface FastifyInstance {
    posthog: PostHog
  }
}

export default fp(async (app) => {
  const token = process.env.POSTHOG_PROJECT_TOKEN

  if (!token && process.env.NODE_ENV !== 'production') {
    app.log.warn(
      'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
    )
  }

  // One client per process. Without a token it is disabled and capture calls are no-ops.
  const posthog = new PostHog(token ?? '', {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    enableExceptionAutocapture: true,
    disabled: !token,
  })

  app.decorate('posthog', posthog)

  // Everything captured while handling a request carries the visitor's identity.
  // Keep this hook callback-based: calling done() inside withContext continues
  // the request in that context.
  app.addHook('onRequest', (request, reply, done) => {
    let distinctId = request.user?.id
    let properties: Record<string, unknown> = {
      $request_method: request.method,
      request_id: request.id,
    }

    if (!distinctId) {
      // Signed-out visitors get a random id for the visit and no person profile.
      distinctId = request.cookies.visit_id
      if (!distinctId) {
        distinctId = randomUUID()
        reply.setCookie('visit_id', distinctId, { httpOnly: true, sameSite: 'lax', path: '/' })
      }
      properties = { ...properties, $process_person_profile: false }
    }

    posthog.withContext({ distinctId, properties }, done, { fresh: true })
  })

  // Fastify handles route errors itself, so exception autocapture never sees them.
  app.setErrorHandler((error: Error & { status?: number; statusCode?: number }, request, reply) => {
    const statusCode = error.status ?? error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500)

    if (statusCode >= 500) {
      posthog.captureException(error, undefined, {
        $response_status_code: statusCode,
        $request_path: request.routeOptions.url,
      })
    }

    reply.code(statusCode).send({ error: statusCode >= 500 ? 'Internal server error' : error.message })
  })

  // app.close() runs this and waits for buffered events to be sent.
  app.addHook('onClose', async () => {
    await posthog.shutdown(3000)
  })
})
