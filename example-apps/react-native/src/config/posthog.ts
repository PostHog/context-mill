import PostHog from 'posthog-react-native'
import Config from 'react-native-config'

// Read POSTHOG_PROJECT_TOKEN optionally from react-native-config and never construct PostHog
// with a dummy placeholder token or disabled flag when POSTHOG_PROJECT_TOKEN is unset.
const token = Config.POSTHOG_PROJECT_TOKEN?.trim() || undefined
const host = Config.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'

if (!token && __DEV__) {
  console.error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  )
}

/**
 * PostHog client instance for bare React Native. Returns null when POSTHOG_PROJECT_TOKEN is unset.
 *
 * Configuration is loaded from .env via react-native-config (embedded at build time).
 * Required peer dependencies: @react-native-async-storage/async-storage,
 * react-native-device-info, react-native-localize, react-native-svg.
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
