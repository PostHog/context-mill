interface PostHogClientLike {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
  capture: (event: string, properties?: Record<string, unknown>) => void
  captureException: (error: unknown, additionalProperties?: Record<string, unknown>) => void
  reset: () => void
}

// Return the PostHog client when @posthog/nuxt is active, or undefined when the project token is unset.
export function usePostHog(): PostHogClientLike | undefined {
  const nuxtApp = useNuxtApp() as { $posthog?: () => PostHogClientLike }
  return nuxtApp.$posthog?.()
}
