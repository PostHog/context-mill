import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import posthog from 'posthog-js'
import type { PostHog, PostHogInterface } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const publicKey = runtimeConfig.public.posthog.publicKey

  // nuxt.config.ts warns about a missing token in development
  if (!publicKey) {
    return { provide: { posthog: undefined } }
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
