import posthog from "posthog-js"

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.includes("eu.") ? "https://eu.posthog.com" : "https://us.posthog.com", // The PostHog app for your region
    // Include the defaults option as required by PostHog
    defaults: '2026-08-30',
    // Enables capturing unhandled exceptions via Error Tracking
    capture_exceptions: true,
    // Turn on debug in development mode
    debug: process.env.NODE_ENV === "development",
    // @ignoreBlockStart
    // Disable request batching in test environment
    request_batching: false,
    opt_out_useragent_filter: true,  // This disables bot detection
    // @ignoreBlockEnd
  });
} else if (process.env.NODE_ENV === "development") {
  console.warn("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.")
}

//IMPORTANT: Never combine this approach with other client-side PostHog initialization approaches, especially components like a PostHogProvider. instrumentation-client.ts is the correct solution for initializating client-side PostHog in Next.js 15.3+ apps.
