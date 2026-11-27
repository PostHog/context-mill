import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPostHogClient } from '../../../utils/posthog-server'

export const Route = createFileRoute('/api/burrito/consider')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { userId, totalConsiderations } = body || {}
        const trimmedUserId = typeof userId === 'string' ? userId.trim() : ''

        // Require an authenticated user ID and skip capture when missing rather than falling back to a placeholder ID.
        if (!trimmedUserId) {
          return json({ error: 'User id is required' }, { status: 400 })
        }

        const sessionId = request.headers.get('X-PostHog-Session-Id')
        const posthog = getPostHogClient()

        // Only capture when PostHog is configured and a valid user ID is present, without PII in event properties.
        if (posthog && trimmedUserId) {
          posthog.capture({
            distinctId: trimmedUserId,
            event: 'burrito_considered',
            properties: {
              $session_id: sessionId || undefined,
              total_considerations: totalConsiderations,
              source: 'api',
            },
          })

          // Flush queued events in this short-lived handler and ignore delivery errors so the request never stalls or fails.
          await posthog.flush().catch(() => {})
        }

        return json({ success: true })
      },
    },
  },
})
