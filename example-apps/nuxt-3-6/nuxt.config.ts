// Read the project token without an empty-string fallback so unconfigured environments stay uninitialized cleanly.
const rawPosthogToken = process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogToken = rawPosthogToken?.trim() ? rawPosthogToken.trim() : undefined

if (!posthogToken && process.env.NODE_ENV !== 'production') {
  console.warn('NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured')
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: posthogToken,
        host: process.env.NUXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com',
        posthogDefaults: '2026-08-30',
      },
    },
  },
})
