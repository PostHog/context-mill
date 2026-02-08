import React, { useRef } from 'react'
import { StatusBar } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native'
import { PostHogProvider } from 'posthog-react-native'

import { AuthProvider } from './src/contexts/AuthContext'
import { RootNavigator, RootStackParamList } from './src/navigation/RootNavigator'
import { posthog } from './src/config/posthog'
import { colors } from './src/styles/theme'

/**
 * Burrito Consideration App
 *
 * A demo React Native application showcasing PostHog analytics integration.
 *
 * Features:
 * - User authentication (demo mode - accepts any credentials)
 * - Burrito consideration counter with event tracking
 * - User profile with statistics
 * - Error tracking demonstration
 *
 * @see https://posthog.com/docs/libraries/react-native
 */
export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)
  const routeNameRef = useRef<string | undefined>()

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.headerBackground}
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          // Store the initial route name
          routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name
        }}
        onStateChange={() => {
          // Track screen views manually for React Navigation v7
          const previousRouteName = routeNameRef.current
          const currentRouteName = navigationRef.current?.getCurrentRoute()?.name

          if (previousRouteName !== currentRouteName && currentRouteName) {
            // Capture screen view event
            posthog.screen(currentRouteName, {
              previous_screen: previousRouteName,
            })
          }

          // Update the stored route name
          routeNameRef.current = currentRouteName
        }}
      >
        {/*
          PostHogProvider is placed INSIDE NavigationContainer for React Navigation v7.

          For React Navigation v7, we disable automatic screen capture and handle it
          manually via onStateChange above. Touch event autocapture is still enabled.

          @see https://posthog.com/docs/libraries/react-native#with-react-navigationnative-and-autocapture
        */}
        <PostHogProvider
          client={posthog}
          autocapture={{
            // Disable automatic screen capture for React Navigation v7
            // We handle screen tracking manually via NavigationContainer.onStateChange
            captureScreens: false,
            // Enable touch event autocapture
            captureTouches: true,
            // Limit which props are captured for touch events
            propsToCapture: ['testID'],
            // Maximum number of elements captured in touch event hierarchy
            maxElementsCaptured: 20,
          }}
        >
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </PostHogProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
