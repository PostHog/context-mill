import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPostHogClient } from '../../../utils/posthog-server'

export const Route = createFileRoute('/api/burrito/consider')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { userId, username, totalConsiderations } = body

        if (!userId) {
          return json(
            { error: 'User id is required' },
            { status: 400 },
          )
        }

        const sessionId = request.headers.get('X-PostHog-Session-Id')

        const posthog = getPostHogClient()
        posthog?.capture({
          distinctId: userId,
          event: 'burrito_considered',
          properties: {
            $session_id: sessionId || undefined,
            total_considerations: totalConsiderations,
            username: username,
            source: 'api',
          },
        })

        // This handler is short-lived; flush so the enqueued event sends before it returns
        await posthog?.flush()

        return json({ success: true })
      },
    },
  },
})
