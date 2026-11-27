import { PostHog } from 'posthog-node'
import { useRuntimeConfig } from '#imports'

let posthogClient: PostHog | null = null
let hasWarnedMissingToken = false

export function useServerPostHog(): PostHog | null {
  const runtimeConfig = useRuntimeConfig()
  const rawKey = runtimeConfig.public.posthog?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  // Return null when the project token is missing instead of constructing a client with an empty key or disabled flag.
  if (!publicKey) {
    if (process.env.NODE_ENV !== 'production' && !hasWarnedMissingToken) {
      hasWarnedMissingToken = true
      console.warn(
        'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return null
  }

  if (!posthogClient) {
    posthogClient = new PostHog(publicKey, {
      host: runtimeConfig.public.posthog?.host || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
      enableExceptionAutocapture: true,
    })
  }

  return posthogClient
}
