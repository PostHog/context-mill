import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { authMiddleware, login, logout, type User } from './auth.js'
import { posthog, posthogMiddleware } from './posthog.js'

const app = new Hono<{ Variables: { user?: User } }>()

// Order matters: auth sets `user` before PostHog reads it.
app.use('*', authMiddleware)
app.use('*', posthogMiddleware)

app.get('/', (c) =>
  c.json({
    message: 'Burrito API. POST /login, POST /burrito, GET /dashboard, GET /profile',
    user: c.get('user') ?? null,
  }),
)

// User identification: identify on login with the app's stable user UUID.
app.post('/login', async (c) => {
  // Reject blank usernames before creating a session, identifying, or capturing
  // so missing identity never falls back to a placeholder user.
  const body = await c.req.json<{ username?: string }>().catch(() => ({}) as { username?: string })
  const username = body.username?.trim()
  if (!username) {
    return c.json({ error: 'username is required' }, 400)
  }

  const user = login(c, username)

  posthog?.identify({
    distinctId: user.id,
    properties: { username: user.username },
  })
  posthog?.capture({
    distinctId: user.id,
    event: 'user_logged_in',
    properties: { login_method: 'username' },
  })

  return c.json({ user })
})

app.post('/logout', (c) => {
  const user = c.get('user')
  if (user) {
    posthog?.capture({
      distinctId: user.id,
      event: 'user_logged_out',
    })
  }
  logout(c)
  return c.body(null, 204)
})

// Custom event. The distinct id comes from the request context.
app.post('/burrito', (c) => {
  posthog?.capture({ event: 'burrito_considered', properties: { source: 'api' } })

  return c.json({ considered: true })
})

// Feature flag.
app.get('/dashboard', async (c) => {
  let newDashboard = false
  try {
    const flags = await posthog?.evaluateFlags()
    newDashboard = flags?.isEnabled('new-dashboard-feature') ?? false
  } catch (error) {
    console.warn('Feature flag evaluation failed', error)
  }

  return c.json({ newDashboard })
})

// Error tracking: onError captures this.
app.get('/profile', () => {
  throw new Error('Profile lookup failed')
})

app.onError((err, c) => {
  posthog?.captureException(err, {
    properties: {
      $request_path: c.req.path,
      $request_method: c.req.method,
    },
  })

  return c.json({ error: 'Internal server error' }, 500)
})

const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})

// Stop accepting requests, then flush queued PostHog events.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async () => {
      await posthog?.shutdown(3000)
      process.exit(0)
    })
  })
}
