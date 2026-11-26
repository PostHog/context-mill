import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import type {} from '@posthog/nuxt'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read PostHog keys without empty-string fallbacks so unset variables never initialize a client with a blank token.
const rawPosthogToken = process.env.NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const posthogToken = rawPosthogToken?.trim() ? rawPosthogToken.trim() : undefined
const posthogHost = process.env.NUXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'
const rawProjectId = process.env.PROJECT_ID
const posthogProjectId = rawProjectId?.trim() ? rawProjectId.trim() : undefined
const rawPersonalApiKey = process.env.PERSONAL_API_KEY
const posthogPersonalApiKey = rawPersonalApiKey?.trim() ? rawPersonalApiKey.trim() : undefined

if (!posthogToken && process.env.NODE_ENV !== 'production') {
  console.warn('NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NUXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured')
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: [resolve(__dirname, 'assets/css/main.css')],
  // Only load @posthog/nuxt when the project token is configured so the module never boots with an empty publicKey.
  modules: posthogToken ? ['@posthog/nuxt'] : [],
  hooks: {
    'imports:extend'(imports) {
      if (!posthogToken) return
      for (let i = imports.length - 1; i >= 0; i--) {
        if (imports[i]?.name === 'usePostHog' && imports[i]?.from?.includes('/app/composables/usePostHog')) {
          imports.splice(i, 1)
        }
      }
    },
  },
  runtimeConfig: {
    public: {
      posthog: {
        publicKey: posthogToken,
        host: posthogHost,
      },
    },
  },
  ...(posthogToken
    ? {
        posthogConfig: {
          publicKey: posthogToken,
          host: posthogHost,
          clientConfig: {
            api_host: '/burrito-relay',
            ui_host: posthogHost.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com',
            defaults: '2026-08-30',
            capture_exceptions: true,
            tracing_headers: ['localhost', 'yourdomain.com'],
          },
          serverConfig: {
            enableExceptionAutocapture: true,
          },
          // Only enable sourcemap uploads when both PERSONAL_API_KEY and PROJECT_ID are configured.
          ...(posthogPersonalApiKey && posthogProjectId
            ? {
                sourcemaps: {
                  enabled: true,
                  projectId: posthogProjectId,
                  personalApiKey: posthogPersonalApiKey,
                  releaseName: 'my-application',
                  releaseVersion: '1.0.0',
                },
              }
            : {}),
        },
      }
    : {}),
})
