import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import posthog from 'posthog-js'
import type { PostHog, PostHogInterface } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const rawKey = runtimeConfig.public.posthog?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  // Leave the client uninitialized when the token is missing instead of passing an empty key, and log an error in development.
  if (!publicKey) {
    if (import.meta.env.DEV) {
      console.error(
        'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
      )
    }
    return { provide: { posthog: undefined as PostHog | undefined } }
  }

  const posthogClient = posthog.init(publicKey, {
    // Events go through the server route in server/routes/burrito-relay
    api_host: '/burrito-relay',
    // The PostHog app for the region in NUXT_PUBLIC_POSTHOG_HOST
    ui_host: String(runtimeConfig.public.posthog.host || '').includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
    defaults: runtimeConfig.public.posthog.posthogDefaults as any,
    // Automatically add X-POSTHOG-SESSION-ID and X-POSTHOG-DISTINCT-ID headers
    // to same-origin requests so server-side events join the same session.
    tracing_headers: [window.location.hostname],
    loaded: (posthog: PostHogInterface) => {
      if (import.meta.env.MODE === 'development') posthog.debug()
    },
  })

  nuxtApp.hook('vue:error', (error) => {
    posthogClient.captureException(error)
  })

  return {
    provide: {
      posthog: posthogClient as PostHog,
    },
  }
})
