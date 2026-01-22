import posthog from 'posthog-js'

// Initialize PostHog for client-side tracking
export function initPostHog() {
  if (typeof window !== 'undefined') {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY!, {
      api_host: '/ingest',
      ui_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.posthog.com',
      // Include the defaults option as required by PostHog
      defaults: '2025-11-30',
      // Enables capturing unhandled exceptions via Error Tracking
      capture_exceptions: true,
      // Turn on debug in development mode
      debug: import.meta.env.DEV,
      // Disable in server-side rendering
      loaded: (posthog) => {
        if (import.meta.env.DEV) posthog.debug()
      },
    })
  }
}

export { posthog }
