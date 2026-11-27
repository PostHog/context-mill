import type { FastifyPluginAsync } from 'fastify'

const routes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => ({
    message: 'Burrito API. POST /login, POST /burrito, GET /dashboard, GET /profile',
    user: request.user ?? null,
  }))

  // User identification: identify on login with the app's stable user UUID.
  app.post<{ Body: { username?: string } }>(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      // Reject blank usernames before creating a session, identifying, or capturing
      // so missing identity never falls back to a placeholder user.
      const username = request.body?.username?.trim()
      if (!username) {
        return reply.code(400).send({ error: 'username is required' })
      }

      const { user, sessionId } = app.auth.login(username)
      reply.setCookie('session', sessionId, { httpOnly: true, sameSite: 'lax', path: '/' })

      app.posthog?.identify({
        distinctId: user.id,
        properties: { username: user.username },
      })
      app.posthog?.capture({
        distinctId: user.id,
        event: 'user_logged_in',
        properties: { login_method: 'username' },
      })

      return { user }
    },
  )

  app.post('/logout', async (request, reply) => {
    if (request.user) {
      app.posthog?.capture({
        distinctId: request.user.id,
        event: 'user_logged_out',
      })
    }
    app.auth.logout(request.cookies.session)
    return reply.clearCookie('session', { path: '/' }).code(204).send()
  })

  // Custom event. The distinct id comes from the request context.
  app.post('/burrito', async () => {
    app.posthog?.capture({ event: 'burrito_considered', properties: { source: 'api' } })

    return { considered: true }
  })

  // Feature flag.
  app.get('/dashboard', async () => {
    let newDashboard = false
    try {
      const flags = await app.posthog?.evaluateFlags()
      newDashboard = flags?.isEnabled('new-dashboard-feature') ?? false
    } catch (error) {
      app.log.warn({ err: error }, 'Feature flag evaluation failed')
    }

    return { newDashboard }
  })

  // Error tracking: the error handler in plugins/posthog.ts captures this.
  app.get('/profile', async () => {
    throw new Error('Profile lookup failed')
  })
}

export default routes
