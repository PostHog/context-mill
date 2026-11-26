import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPostHogClient } from '../../../utils/posthog-server'

const users = new Map<
  string,
  { id: string; username: string; burritoConsiderations: number }
>()

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { username, password } = body || {}
        const trimmedUsername =
          typeof username === 'string' ? username.trim() : ''

        // Reject missing credentials early so login never creates or tracks a blank user identity.
        if (!trimmedUsername || !password) {
          return json(
            { error: 'Username and password required' },
            { status: 400 },
          )
        }

        const isNewUser = !users.has(trimmedUsername)

        let user = users.get(trimmedUsername)
        if (!user) {
          user = {
            id: crypto.randomUUID(),
            username: trimmedUsername,
            burritoConsiderations: 0,
          }
          users.set(trimmedUsername, user)
        }

        const sessionId = request.headers.get('X-PostHog-Session-Id')
        const posthog = getPostHogClient()

        // Only capture when PostHog is configured and a stable user ID exists, keeping PII out of event properties.
        if (posthog && user.id) {
          posthog.capture({
            distinctId: user.id,
            event: 'server_login',
            properties: {
              $session_id: sessionId || undefined,
              isNewUser,
              source: 'api',
            },
          })

          // Flush queued events in this short-lived handler and ignore delivery errors so login still succeeds.
          await posthog.flush().catch(() => {})
        }

        return json({ success: true, user })
      },
    },
  },
})
