import { PostHog } from 'posthog-node'

export interface Env {
  POSTHOG_PROJECT_TOKEN?: string
  POSTHOG_HOST?: string
  ENVIRONMENT?: string
}

let warnedMissingToken = false

// Create a new client per request. Workers can be frozen as soon as the
// response is sent, so the client sends every event immediately instead of
// batching, and the caller shuts it down inside ctx.waitUntil().
export function createPostHogClient(env: Env): PostHog | null {
  // Return null when the project token is unset rather than passing an empty or
  // placeholder key, so unconfigured environments stay uninitialized cleanly.
  const token = env.POSTHOG_PROJECT_TOKEN?.trim()
  if (!token) {
    if (env.ENVIRONMENT !== 'production' && !warnedMissingToken) {
      warnedMissingToken = true
      console.warn(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
      )
    }
    return null
  }

  return new PostHog(token, {
    host: env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 2000,
    fetchRetryCount: 0,
    enableExceptionAutocapture: true,
  })
}
