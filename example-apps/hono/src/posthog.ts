import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { randomUUID } from 'node:crypto'
import { PostHog } from 'posthog-node'
import type { User } from './auth.js'

// Leave posthog null when POSTHOG_PROJECT_TOKEN is unset rather than passing
// an empty string with disabled set to true.
const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()

if (!token && process.env.NODE_ENV !== 'production') {
  console.warn(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  )
}

export const posthog: PostHog | null = token
  ? new PostHog(token, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      enableExceptionAutocapture: true,
    })
  : null

// Everything captured while handling a request carries the visitor's identity.
// Register this after the middleware that sets `user`.
export const posthogMiddleware = createMiddleware<{ Variables: { user?: User } }>(async (c, next) => {
  if (!posthog) return next()

  const user = c.get('user')
  let distinctId = user?.id
  const properties: Record<string, unknown> = {
    $request_method: c.req.method,
    $request_path: c.req.path,
  }
  let options: { process_person_profile?: boolean } = {}

  if (!distinctId) {
    // Signed-out visitors get a per-visit cookie UUID with person profile
    // creation disabled instead of sharing a literal anonymous string.
    distinctId = getCookie(c, 'visit_id')
    if (!distinctId) {
      distinctId = randomUUID()
      setCookie(c, 'visit_id', distinctId, { httpOnly: true, sameSite: 'Lax', path: '/' })
    }
    options = { process_person_profile: false }
  }

  return posthog.withContext({ distinctId, properties, options }, next, { fresh: true })
})
