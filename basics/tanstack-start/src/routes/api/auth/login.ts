import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getPostHogClient } from '../../../lib/posthog-server'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json()
        const { username, password } = body

        // Simple validation (in production, you'd verify against a real database)
        if (!username || !password) {
          return json(
            { error: 'Username and password required' },
            { status: 400 },
          )
        }

        // Check if this is a new user (simplified - in production use a database)
        const isNewUser = !username

        // Create or get user
        const user = {
          username,
          burritoConsiderations: 0,
        }

        // Capture server-side login event
        const posthog = getPostHogClient()
        posthog.capture({
          distinctId: username,
          event: 'server_login',
          properties: {
            username: username,
            isNewUser: isNewUser,
            source: 'api',
          },
        })

        // Identify user on server side
        posthog.identify({
          distinctId: username,
          properties: {
            username: username,
            createdAt: isNewUser ? new Date().toISOString() : undefined,
          },
        })

        return json({ success: true, user })
      },
    },
  },
})
