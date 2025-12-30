import { PostHog } from 'posthog-node'

export function getPostHogClient() {
  const posthogClient = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY!, {
    host: process.env.VITE_PUBLIC_POSTHOG_HOST!,
    flushAt: 1,
    flushInterval: 0
  })
  return posthogClient
}