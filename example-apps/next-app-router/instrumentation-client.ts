import posthog from "posthog-js"

// Leave missing tokens unset and leave the client uninitialized rather than passing an empty or placeholder key.
const rawToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
const token = rawToken?.trim()

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
  console.error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured")
}

// Keep client-side PostHog initialization in instrumentation-client.ts for Next.js 15.3+ apps instead of duplicating it in a provider component.
