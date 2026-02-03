// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: process.env.NUXT_PUBLIC_POSTHOG_KEY,
        host: process.env.NUXT_PUBLIC_POSTHOG_HOST,
        posthogDefaults: '2025-11-30',
      },
    },
  },
})

