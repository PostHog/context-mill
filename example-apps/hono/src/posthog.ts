import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { randomUUID } from 'node:crypto'
import { PostHog } from 'posthog-node'
import type { User } from './auth.js'

const token = process.env.POSTHOG_PROJECT_TOKEN

if (!token && process.env.NODE_ENV !== 'production') {
  console.warn(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  )
}

// One client per process. Without a token it is disabled and capture calls are no-ops.
export const posthog = new PostHog(token ?? '', {
  host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  enableExceptionAutocapture: true,
  disabled: !token,
})

// Everything captured while handling a request carries the visitor's identity.
// Register this after the middleware that sets `user`.
export const posthogMiddleware = createMiddleware<{ Variables: { user?: User } }>(async (c, next) => {
  const user = c.get('user')
  let distinctId = user?.id
  let properties: Record<string, unknown> = {
    $request_method: c.req.method,
    $request_path: c.req.path,
  }

  if (!distinctId) {
    // Signed-out visitors get a random id for the visit and no person profile.
    distinctId = getCookie(c, 'visit_id')
    if (!distinctId) {
      distinctId = randomUUID()
      setCookie(c, 'visit_id', distinctId, { httpOnly: true, sameSite: 'Lax', path: '/' })
    }
    properties = { ...properties, $process_person_profile: false }
  }

  return posthog.withContext({ distinctId, properties }, next, { fresh: true })
})
