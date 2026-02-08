import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { usePostHog } from 'posthog-react-native'
import { useAuth } from '../src/contexts/AuthContext'
import { colors, spacing, typography, borderRadius, shadows } from '../src/styles/theme'

/**
 * Profile Screen
 *
 * Displays user information and demonstrates PostHog error tracking.
 * The test error button shows how to capture exceptions manually.
 *
 * @see https://posthog.com/docs/libraries/react-native#error-tracking
 */
export default function ProfileScreen() {
  const { user } = useAuth()
  const router = useRouter()
  const posthog = usePostHog()

  // Redirect to home if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/')
    }
  }, [user, router])

  if (!user) {
    return null
  }

  /**
   * Triggers a test error and captures it in PostHog
   *
   * This demonstrates manual exception capture using the $exception event.
   * In production, you would typically set up automatic exception capture
   * or use the before_send callback for customization.
   *
   * @see https://posthog.com/docs/libraries/react-native#error-tracking
   */
  const triggerTestError = () => {
    try {
      throw new Error('Test error for PostHog error tracking')
    } catch (err) {
      const error = err as Error

      // Capture exception in PostHog
      // @see https://posthog.com/docs/error-tracking
      posthog.capture('$exception', {
        $exception_list: [
          {
            type: error.name,
            value: error.message,
            stacktrace: {
              type: 'raw',
              frames: error.stack ?? '',
            },
          },
        ],
        $exception_source: 'react-native',
        // Additional context
        username: user.username,
        screen: 'Profile',
      })

      console.error('Captured error:', error)
      Alert.alert('Error Captured', 'The test error has been sent to PostHog!', [{ text: 'OK' }])
    }
  }

  const getJourneyMessage = () => {
    const count = user.burritoConsiderations
    if (count === 0) {
      return "You haven't considered any burritos yet. Visit the Burrito Consideration page to start!"
    } else if (count === 1) {
      return "You've considered the burrito potential once. Keep going!"
    } else if (count < 5) {
      return "You're getting the hang of burrito consideration!"
    } else if (count < 10) {
      return "You're becoming a burrito consideration expert!"
    } else {
      return 'You are a true burrito consideration master!'
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>User Profile</Text>

        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Your Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username:</Text>
            <Text style={styles.infoValue}>{user.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Burrito Considerations:</Text>
            <Text style={styles.infoValue}>{user.burritoConsiderations}</Text>
          </View>
        </View>

        {/*
          testID is captured by PostHog autocapture for touch events
          @see https://posthog.com/docs/libraries/react-native#autocapture
        */}
        <TouchableOpacity
          style={styles.errorButton}
          onPress={triggerTestError}
          activeOpacity={0.8}
          testID="trigger-error-button"
        >
          <Text style={styles.buttonText}>Trigger Test Error (for PostHog)</Text>
        </TouchableOpacity>

        <View style={styles.journey}>
          <Text style={styles.journeyTitle}>Your Burrito Journey</Text>
          <Text style={styles.journeyText}>{getJourneyMessage()}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.md,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  stats: {
    backgroundColor: colors.statsBackground,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
  },
  statsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.text,
    marginRight: spacing.xs,
  },
  infoValue: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  errorButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  journey: {
    marginTop: spacing.lg,
  },
  journeyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  journeyText: {
    fontSize: typography.sizes.md,
    color: colors.text,
    lineHeight: 24,
  },
})
