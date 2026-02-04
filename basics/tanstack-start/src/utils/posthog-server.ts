import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.VITE_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY!,
      {
        host: process.env.VITE_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
      },
    )
  }
  return posthogClient
}

