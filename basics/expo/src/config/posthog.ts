import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'

// Use const (not var) for static analysis optimization
const apiKey = Constants.expoConfig?.extra?.posthogApiKey as string | undefined
const host = Constants.expoConfig?.extra?.posthogHost as string | undefined
const isPostHogConfigured = apiKey && apiKey !== 'phc_your_api_key_here'

// Debug: log config on startup
console.log('PostHog config:', {
  apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET',
  host: host || 'DEFAULT',
  isConfigured: isPostHogConfigured,
})

if (!isPostHogConfigured) {
  console.warn(
    'PostHog API key not configured. Analytics will be disabled. ' +
      'Set POSTHOG_API_KEY in your .env file to enable analytics.'
  )
}

export const posthog = new PostHog(apiKey || 'placeholder_key', {
  host: Constants.expoConfig?.extra?.posthogHost || 'https://us.i.posthog.com',
  disabled: !isPostHogConfigured,
  captureAppLifecycleEvents: true,
  flushAt: 20,
  flushInterval: 10000,
  preloadFeatureFlags: true,
  sendFeatureFlagEvent: true,
})

export const isPostHogEnabled = isPostHogConfigured
