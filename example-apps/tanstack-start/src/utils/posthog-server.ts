import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null
let hasWarnedMissingToken = false

export function getPostHogClient(): PostHog | null {
  const rawToken =
    process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ??
    import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
  const token =
    typeof rawToken === 'string' && rawToken.trim()
      ? rawToken.trim()
      : undefined

  // Return null when the project token is missing instead of constructing a client with an empty fallback key.
  if (!token) {
    if (
      !import.meta.env.PROD &&
      process.env.NODE_ENV !== 'production' &&
      !hasWarnedMissingToken
    ) {
      hasWarnedMissingToken = true
      console.warn(
        'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(token, {
      host:
        process.env.VITE_PUBLIC_POSTHOG_HOST ||
        import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
        'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }
  return posthogClient
}
