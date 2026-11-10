import type { FastifyPluginAsync } from 'fastify'

const routes: FastifyPluginAsync = async (app) => {
  app.get('/', async (request) => ({
    message: 'Burrito API. POST /login, POST /burrito, GET /dashboard, GET /profile',
    user: request.user ?? null,
  }))

  // User identification: identify once, on login, with the app's own user id.
  app.post<{ Body: { username?: string } }>(
    '/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const username = request.body?.username?.trim()
      if (!username) {
        return reply.code(400).send({ error: 'username is required' })
      }

      const { user, sessionId } = app.auth.login(username)
      reply.setCookie('session', sessionId, { httpOnly: true, sameSite: 'lax', path: '/' })

      app.posthog.identify({
        distinctId: user.id,
        properties: { username: user.username },
      })

      return { user }
    }
  )

  app.post('/logout', async (request, reply) => {
    app.auth.logout(request.cookies.session)
    return reply.clearCookie('session', { path: '/' }).code(204).send()
  })

  // Custom event. The distinct id comes from the request context.
  app.post('/burrito', async () => {
    app.posthog.capture({ event: 'burrito_considered', properties: { source: 'api' } })

    return { considered: true }
  })

  // Feature flag.
  app.get('/dashboard', async () => {
    const flags = await app.posthog.evaluateFlags()

    return { newDashboard: flags.isEnabled('new-dashboard-feature') }
  })

  // Error tracking: the error handler in plugins/posthog.ts captures this.
  app.get('/profile', async () => {
    throw new Error('Profile lookup failed')
  })
}

export default routes
