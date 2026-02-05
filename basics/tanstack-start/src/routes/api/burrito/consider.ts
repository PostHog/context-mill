import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPostHogClient } from '../../../utils/posthog-server'

export const Route = createFileRoute('/api/burrito/consider')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { username, totalConsiderations } = body

        if (!username) {
          return json(
            { error: 'Username is required' },
            { status: 400 },
          )
        }

        const sessionId = request.headers.get('X-PostHog-Session-Id')

        const posthog = getPostHogClient()
        posthog.capture({
          distinctId: username,
          event: 'burrito_considered',
          properties: {
            $session_id: sessionId || undefined,
            total_considerations: totalConsiderations,
            username: username,
            source: 'api',
          },
        })

        return json({ success: true })
      },
    },
  },
})
