import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'

// Read the project token optionally from app.config.js extras and never construct PostHog
// with a dummy placeholder token or disabled flag when POSTHOG_PROJECT_TOKEN is unset.
const rawProjectToken = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined
const token = rawProjectToken?.trim() || undefined
const rawHost = Constants.expoConfig?.extra?.posthogHost as string | undefined
const host = rawHost?.trim() || 'https://us.i.posthog.com'

if (!token && __DEV__) {
  console.error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
  )
}

/**
 * PostHog client instance for Expo. Returns null when POSTHOG_PROJECT_TOKEN is unset.
 *
 * Configuration is loaded from app.config.js extras via expo-constants.
 * Required peer dependencies: expo-file-system, expo-application,
 * expo-device, expo-localization, react-native-svg.
 *
 * @see https://posthog.com/docs/libraries/react-native
 */
export const posthog: PostHog | null = token
  ? new PostHog(token, {
      host,
      captureAppLifecycleEvents: true,
      flushAt: 20,
      flushInterval: 10000,
      maxBatchSize: 100,
      maxQueueSize: 1000,
      preloadFeatureFlags: true,
      sendFeatureFlagEvent: true,
      featureFlagsRequestTimeoutMs: 10000,
      requestTimeout: 10000,
      fetchRetryCount: 3,
      fetchRetryDelay: 3000,
    })
  : null

if (posthog && __DEV__) {
  posthog.debug(true)
}

export const isPostHogEnabled = posthog !== null
