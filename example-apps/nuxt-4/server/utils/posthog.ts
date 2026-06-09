import { PostHog } from 'posthog-node'

let client: PostHog | null = null

export function useServerPostHog(): PostHog {
  if (!client) {
    const config = useRuntimeConfig()
    // The @posthog/nuxt module exposes config at runtimeConfig.public.posthog
    const posthogConfig = config.public.posthog
    client = new PostHog(posthogConfig.publicKey, {
      host: posthogConfig.host,
    })
  }
  return client
}
