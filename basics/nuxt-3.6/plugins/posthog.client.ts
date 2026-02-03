import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import posthog from 'posthog-js'
import type { PostHog, PostHogInterface } from 'posthog-js'

export default defineNuxtPlugin((nuxtApp) => {
  const runtimeConfig = useRuntimeConfig()
  const posthogClient = posthog.init(runtimeConfig.public.posthog.publicKey, {
    api_host: runtimeConfig.public.posthog.host,
    defaults: runtimeConfig.public.posthog.posthogDefaults as any,
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
