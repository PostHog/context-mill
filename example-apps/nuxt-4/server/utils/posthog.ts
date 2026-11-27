import { PostHog } from 'posthog-node'

let client: PostHog | null = null
let hasWarnedMissingToken = false

export function useServerPostHog(): PostHog | null {
  const config = useRuntimeConfig()
  const posthogConfig = config.public.posthog
  const rawKey = posthogConfig?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  // Return null when the project token is missing instead of constructing PostHog with an empty key or disabled flag.
  if (!publicKey) {
    if (process.env.NODE_ENV !== 'production' && !hasWarnedMissingToken) {
      hasWarnedMissingToken = true
      console.warn(
        'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  if (!client) {
    client = new PostHog(publicKey, {
      host: posthogConfig?.host || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }
  return client
}
