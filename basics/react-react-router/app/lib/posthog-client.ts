import posthog from "posthog-js";

// Initialize PostHog client-side
if (typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    // Include the defaults option as required by PostHog
    person_profiles: 'identified_only',
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Turn on debug in development mode
    debug: import.meta.env.DEV,
  });
}

export default posthog;
