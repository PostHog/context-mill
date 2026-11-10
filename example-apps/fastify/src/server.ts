import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import auth from './plugins/auth.js'
import posthog from './plugins/posthog.js'
import routes from './routes.js'

const app = Fastify({ logger: true })

// Order matters: auth sets request.user before PostHog reads it, and both
// register before the routes.
// Rate limits apply only to routes that opt in through their config, such as /login.
await app.register(rateLimit, { global: false })
await app.register(auth)
await app.register(posthog)
await app.register(routes)

// Closing the app runs the onClose hook, which flushes PostHog.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.close().then(() => process.exit(0))
  })
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
