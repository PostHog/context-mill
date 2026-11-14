import { PostHog } from 'posthog-node'

export interface Env {
  POSTHOG_PROJECT_TOKEN?: string
  POSTHOG_HOST?: string
  ENVIRONMENT?: string
}

// Create a new client per request. Workers can be frozen as soon as the
// response is sent, so the client sends every event immediately instead of
// batching, and the caller shuts it down inside ctx.waitUntil().
export function createPostHogClient(env: Env): PostHog | null {
  if (!env.POSTHOG_PROJECT_TOKEN) {
    if (env.ENVIRONMENT !== 'production') {
      console.warn(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
      )
    }
    return null
  }

  return new PostHog(env.POSTHOG_PROJECT_TOKEN, {
    host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
  })
}
