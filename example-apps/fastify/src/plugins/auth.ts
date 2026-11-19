import cookie from '@fastify/cookie'
import { randomUUID } from 'node:crypto'
import fp from 'fastify-plugin'

export interface User {
  id: string
  username: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User
  }
  interface FastifyInstance {
    auth: {
      login(username: string): { user: User; sessionId: string }
      logout(sessionId: string | undefined): void
    }
  }
}

// In-memory users and sessions stand in for a real database and session store.
export default fp(async (app) => {
  const users = new Map<string, User>()
  const sessions = new Map<string, User>()

  await app.register(cookie)

  app.decorate('auth', {
    login(username: string) {
      let user = users.get(username)
      if (!user) {
        user = { id: randomUUID(), username }
        users.set(username, user)
      }
      const sessionId = randomUUID()
      sessions.set(sessionId, user)
      return { user, sessionId }
    },
    logout(sessionId: string | undefined) {
      if (sessionId) sessions.delete(sessionId)
    },
  })

  // Populates request.user from the session cookie. PostHog's hook runs after this one.
  app.addHook('onRequest', (request, _reply, done) => {
    const sessionId = request.cookies.session
    request.user = sessionId ? sessions.get(sessionId) : undefined
    done()
  })
})
