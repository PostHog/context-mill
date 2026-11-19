import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

if (!process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NODE_ENV === 'development') {
  console.warn('NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog will not capture events.')
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [resolve(__dirname, 'assets/css/main.css')],
  modules: ['@posthog/nuxt'],
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '',
        host: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      },
    },
  },
  posthogConfig: {
    publicKey: process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN || '', // Find it in project settings https://app.posthog.com/settings/project
    host: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com', // Optional: defaults to https://us.i.posthog.com. Use https://eu.i.posthog.com for EU region
    clientConfig: {
      api_host: '/burrito-relay', // Events go through the server route in server/routes/burrito-relay
      ui_host: (process.env.NUXT_PUBLIC_POSTHOG_HOST || '').includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com', // The PostHog app for your region
      defaults: '2026-08-30',
      capture_exceptions: true, // Enables automatic exception capture on the client side (Vue)
      tracing_headers: [ 'localhost', 'yourdomain.com' ], // Add your domain here
    },
    serverConfig: {
      enableExceptionAutocapture: true, // Enables automatic exception capture on the server side (Nitro)
    },
    sourcemaps: {
      enabled: Boolean(process.env.PERSONAL_API_KEY), // Upload only when a personal API key is set
      envId: process.env.PROJECT_ID || '', // Your project ID from PostHog settings https://app.posthog.com/settings/environment#variables
      personalApiKey: process.env.PERSONAL_API_KEY || '', // Your personal API key from PostHog settings https://app.posthog.com/settings/user-api-keys (requires organization:read and error_tracking:write scopes)
      project: 'my-application', // Optional: defaults to git repository name
      version: '1.0.0', // Optional: defaults to current git commit
    },
  },
})

