import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'

// Configuration loaded from app.config.js extras via expo-constants
// Environment variables are read at build time in app.config.js
const apiKey = Constants.expoConfig?.extra?.posthogApiKey as string | undefined
const host = (Constants.expoConfig?.extra?.posthogHost as string) || 'https://us.i.posthog.com'
const isPostHogConfigured = apiKey && apiKey !== 'phc_your_api_key_here'

if (__DEV__) {
  console.log('PostHog config:', {
    apiKey: apiKey ? `SET` : 'NOT SET',
    host,
    isConfigured: isPostHogConfigured,
  })
}

if (!isPostHogConfigured) {
  console.warn(
    'PostHog API key not configured. Analytics will be disabled. ' +
      'Set POSTHOG_API_KEY in your .env file to enable analytics.'
  )
}

/**
 * PostHog client instance for Expo
 *
 * Configuration loaded from app.config.js extras via expo-constants.
 * Required peer dependencies: expo-file-system, expo-application,
 * expo-device, expo-localization
 *
 * For React Native Web targets, use @react-native-async-storage/async-storage
 * instead of expo-file-system (Web and macOS targets not supported by expo-file-system).
 *
 * @see https://posthog.com/docs/libraries/react-native
 */
export const posthog = new PostHog(apiKey || 'placeholder_key', {
  // PostHog API host
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

export const isPostHogEnabled = isPostHogConfigured
