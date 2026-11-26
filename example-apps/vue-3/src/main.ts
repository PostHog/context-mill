import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import posthog from "posthog-js";

const app = createApp(App);

const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-08-30',
  });
} else if (import.meta.env.DEV) {
  console.error('VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured');
}

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  // report error to tracking services
  posthog.captureException(err)
}

app.mount('#app')
