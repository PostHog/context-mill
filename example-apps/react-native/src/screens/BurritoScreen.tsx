import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { usePostHog } from 'posthog-react-native'
import { useAuth } from '../contexts/AuthContext'
import { RootStackParamList } from '../navigation/RootNavigator'
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '../styles/theme'

type BurritoScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Burrito'
>

/**
 * Burrito Consideration Screen
 *
 * Demonstrates PostHog event tracking with custom properties.
 * Each time the user considers a burrito, an event is captured.
 *
 * @see https://posthog.com/docs/libraries/react-native#capturing-events
 */
export default function BurritoScreen() {
  const { user, incrementBurritoConsiderations } = useAuth()
  const navigation = useNavigation<BurritoScreenNavigationProp>()
  const posthog = usePostHog()
  const [hasConsidered, setHasConsidered] = useState(false)

  // Redirect to home if not logged in
  useEffect(() => {
    if (!user) {
      navigation.navigate('Home')
    }
  }, [user, navigation])

  if (!user) {
    return null
  }

  const handleConsideration = async () => {
    const newCount = user.burritoConsiderations + 1

    // Update state first for immediate feedback
    await incrementBurritoConsiderations()
    setHasConsidered(true)

    // Hide success message after 2 seconds
    setTimeout(() => setHasConsidered(false), 2000)

    // Capture custom event in PostHog with properties
    // We recommend using a [object] [verb] format for event names
    // @see https://posthog.com/docs/libraries/react-native#capturing-events
    posthog.capture('burrito_considered', {
      total_considerations: newCount,
      username: user.username,
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Burrito Consideration Zone</Text>
        <Text style={styles.text}>
          Take a moment to truly consider the potential of burritos.
        </Text>

        {/*
          testID is captured by PostHog autocapture for touch events
          This helps identify the button in analytics
          @see https://posthog.com/docs/libraries/react-native#autocapture
        */}
        <TouchableOpacity
          style={styles.burritoButton}
          onPress={handleConsideration}
          activeOpacity={0.8}
          testID="consider-burrito-button"
        >
          <Text style={styles.burritoButtonText}>Consider Burrito</Text>
        </TouchableOpacity>

        {hasConsidered && (
          <View style={styles.successContainer}>
            <Text style={styles.success}>
              Thank you for your consideration!
            </Text>
            <Text style={styles.successCount}>
              Count: {user.burritoConsiderations}
            </Text>
          </View>
        )}

        <View style={styles.stats}>
          <Text style={styles.statsTitle}>Consideration Stats</Text>
          <Text style={styles.statsText}>
            Total considerations: {user.burritoConsiderations}
          </Text>
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
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.sizes.md,
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  burritoButton: {
    backgroundColor: colors.burrito,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.md,
    ...shadows.sm,
  },
  burritoButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  successContainer: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  success: {
    color: colors.success,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  successCount: {
    color: colors.success,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginTop: spacing.xs,
  },
  stats: {
    backgroundColor: colors.statsBackground,
    padding: spacing.md,
    borderRadius: borderRadius.sm,
    marginTop: spacing.lg,
  },
  statsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  statsText: {
    fontSize: typography.sizes.md,
    color: colors.text,
  },
})
