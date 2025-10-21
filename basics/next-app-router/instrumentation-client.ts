import posthog from "posthog-js"

// Debug environment variables
console.log('🔍 Environment Debug Info:');
console.log('  - NODE_ENV:', process.env.NODE_ENV);
console.log('  - POSTHOG_TEST_MODE:', process.env.POSTHOG_TEST_MODE);
console.log('  - Is Test Mode:', process.env.POSTHOG_TEST_MODE === 'true');

const isTestMode = process.env.POSTHOG_TEST_MODE === 'true';

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  // Include the defaults option as required by PostHog
  defaults: '2025-05-24',
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  // Turn on debug in development mode
  debug: process.env.NODE_ENV === "development",
  // Disable request batching in test environment
  request_batching: true,
  opt_out_useragent_filter: true,  // This disables bot detection
});
