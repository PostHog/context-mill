import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import posthog from 'posthog-js'
import { useAuthStore } from './stores/auth'

const app = createApp(App)

// Leave missing tokens unset and leave the client uninitialized rather than passing an empty or placeholder key.
const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim()

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-08-30',
  })
} else if (import.meta.env.DEV) {
  console.error(
    'VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured',
  )
}

const pinia = createPinia()
app.use(pinia)

// Hydrate the auth store after PostHog initializes so any persisted user session is re-identified on boot.
useAuthStore(pinia)

app.use(router)

app.config.errorHandler = (err) => {
  // Report uncaught Vue errors to PostHog
  posthog.captureException(err)
}

app.mount('#app')
