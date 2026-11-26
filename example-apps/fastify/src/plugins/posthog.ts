import { randomUUID } from 'node:crypto'
import fp from 'fastify-plugin'
import { PostHog } from 'posthog-node'

declare module 'fastify' {
  interface FastifyInstance {
    posthog: PostHog | null
  }
}

export default fp(async (app) => {
  // Fastify handles route errors itself, so exception autocapture never sees them.
  // Register this handler unconditionally so error responses stay consistent even
  // when PostHog is unconfigured.
  app.setErrorHandler((error: Error & { status?: number; statusCode?: number }, request, reply) => {
    const statusCode = error.status ?? error.statusCode ?? (reply.statusCode >= 400 ? reply.statusCode : 500)

    if (statusCode >= 500) {
      app.posthog?.captureException(error, {
        properties: {
          $response_status_code: statusCode,
          $request_path: request.routeOptions.url,
        },
      })
    }

    reply.code(statusCode).send({ error: statusCode >= 500 ? 'Internal server error' : error.message })
  })

  // Decorate null when POSTHOG_PROJECT_TOKEN is unset rather than passing an empty
  // string with disabled set to true, and skip request context and shutdown hooks.
  const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()

  if (!token) {
    if (process.env.NODE_ENV !== 'production') {
      app.log.warn(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    app.decorate('posthog', null)
    return
  }

  const posthog = new PostHog(token, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    enableExceptionAutocapture: true,
  })

  app.decorate('posthog', posthog)

  // Everything captured while handling a request carries the visitor's identity.
  // Keep this hook callback-based so calling done() inside withContext continues
  // the request in that context.
  app.addHook('onRequest', (request, reply, done) => {
    let distinctId = request.user?.id
    const properties: Record<string, unknown> = {
      $request_method: request.method,
      request_id: request.id,
    }
    let options: { process_person_profile?: boolean } = {}

    if (!distinctId) {
      // Signed-out visitors get a per-visit cookie UUID with person profile
      // creation disabled instead of sharing a literal anonymous string.
      distinctId = request.cookies.visit_id
      if (!distinctId) {
        distinctId = randomUUID()
        reply.setCookie('visit_id', distinctId, { httpOnly: true, sameSite: 'lax', path: '/' })
      }
      options = { process_person_profile: false }
    }

    posthog.withContext({ distinctId, properties, options }, done, { fresh: true })
  })

  // app.close() runs this and waits for buffered events to be sent.
  app.addHook('onClose', async () => {
    await posthog.shutdown(3000)
  })
})
