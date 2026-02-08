import PostHog from 'posthog-react-native'
import Config from 'react-native-config'

// Environment variables are embedded at build time via react-native-config
// Ensure .env file exists with POSTHOG_API_KEY and POSTHOG_HOST
const apiKey = Config.POSTHOG_API_KEY
const host = Config.POSTHOG_HOST || 'https://us.i.posthog.com'
const isPostHogConfigured = apiKey && apiKey !== 'phc_your_api_key_here'

if (!isPostHogConfigured) {
  console.warn(
    'PostHog API key not configured. Analytics will be disabled. ' +
    'Set POSTHOG_API_KEY in your .env file to enable analytics.'
  )
}

/**
 * PostHog client instance for bare React Native
 *
 * Configuration loaded from .env via react-native-config (embedded at build time).
 * Required peer dependencies: @react-native-async-storage/async-storage,
 * react-native-device-info, react-native-localize
 *
 * @see https://posthog.com/docs/libraries/react-native
 */
export const posthog = new PostHog(apiKey || 'placeholder_key', {
  // PostHog API host (usually 'https://us.i.posthog.com' or 'https://eu.i.posthog.com')
  host,

  // Disable PostHog if API key is not configured
  disabled: !isPostHogConfigured,

  // Capture app lifecycle events:
  // - Application Installed, Application Updated
  // - Application Opened, Application Became Active, Application Backgrounded
  captureAppLifecycleEvents: true,

  // Enable debug mode in development for verbose logging
  debug: __DEV__,

  // Batching: queue events and flush periodically to optimize battery usage
  flushAt: 20,              // Number of events to queue before sending
  flushInterval: 10000,     // Interval in ms between periodic flushes
  maxBatchSize: 100,        // Maximum events per batch
  maxQueueSize: 1000,       // Maximum queued events (oldest dropped when full)

  // Feature flags
  preloadFeatureFlags: true,        // Load flags on initialization
  sendFeatureFlagEvent: true,       // Track getFeatureFlag calls for experiments
  featureFlagsRequestTimeoutMs: 10000, // Timeout for flag requests (prevents blocking)

  // Network settings
  requestTimeout: 10000,    // General request timeout in ms
  fetchRetryCount: 3,       // Number of retry attempts for failed requests
  fetchRetryDelay: 3000,    // Delay between retries in ms
})

// Export helper to check if PostHog is enabled
export const isPostHogEnabled = isPostHogConfigured
