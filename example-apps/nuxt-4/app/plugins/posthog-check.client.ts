export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()
  const rawKey = runtimeConfig.public.posthog?.publicKey
  const publicKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : undefined

  // Log an error in the browser console during development when the token is missing instead of initializing with an empty key.
  if (!publicKey && import.meta.dev) {
    console.error(
      'NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
    )
  }
})
