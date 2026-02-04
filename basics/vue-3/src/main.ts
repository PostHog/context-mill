import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import posthog from "posthog-js";

const app = createApp(App);

posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  defaults: '2025-11-30',
});

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  // report error to tracking services
  posthog.captureException(err)
}

app.mount('#app')
