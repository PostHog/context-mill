import PostHog from 'posthog-react-native'
import Config from 'react-native-config'

// Check if PostHog API key is configured
const apiKey = Config.POSTHOG_API_KEY
const isPostHogConfigured = apiKey && apiKey !== 'phc_your_api_key_here'

if (!isPostHogConfigured) {
  console.warn(
    'PostHog API key not configured. Analytics will be disabled. ' +
    'Set POSTHOG_API_KEY in your .env file to enable analytics.'
  )
}

/**
 * PostHog client instance
 *
 * Initialized with API key and host from environment variables.
 * If no API key is provided, PostHog will be disabled.
 *
 * @see https://posthog.com/docs/libraries/react-native
 */
export const posthog = new PostHog(apiKey || 'placeholder_key', {
  // PostHog API host (usually 'https://us.i.posthog.com' or 'https://eu.i.posthog.com')
  host: Config.POSTHOG_HOST || 'https://us.i.posthog.com',

  // Disable PostHog if API key is not configured
  disabled: !isPostHogConfigured,

  // Capture app lifecycle events:
  // - Application Installed
  // - Application Updated
  // - Application Opened
  // - Application Became Active
  // - Application Backgrounded
  captureAppLifecycleEvents: true,

  // Enable debug mode in development for verbose logging
  debug: __DEV__,

  // Number of events to queue before sending to PostHog
  flushAt: 20,

  // Interval in milliseconds between periodic flushes
  flushInterval: 10000,

  // Preload feature flags when initialized
  preloadFeatureFlags: true,

  // Whether to track that getFeatureFlag was called (used by experiments)
  sendFeatureFlagEvent: true,
})

// Export helper to check if PostHog is enabled
export const isPostHogEnabled = isPostHogConfigured
