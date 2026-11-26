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
 * @see https://posthog.com/docs/libraries/react-native
 */
export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)
  const routeNameRef = useRef<string | undefined>(undefined)

  const appTree = (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.headerBackground}
      />
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name
        }}
        onStateChange={() => {
          // Track screen views manually for React Navigation v7 when PostHog is configured.
          const previousRouteName = routeNameRef.current
          const currentRouteName = navigationRef.current?.getCurrentRoute()?.name

          if (previousRouteName !== currentRouteName && currentRouteName) {
            posthog?.screen(currentRouteName, {
              previous_screen: previousRouteName ?? null,
            })
          }

          routeNameRef.current = currentRouteName
        }}
      >
        {/*
          PostHogProvider is placed inside NavigationContainer for React Navigation v7
          only when a valid PostHog client is configured.
        */}
        {posthog ? (
          <PostHogProvider
            client={posthog}
            autocapture={{
              captureScreens: false,
              captureTouches: true,
              propsToCapture: ['testID'],
              maxElementsCaptured: 20,
            }}
          >
            {appTree}
          </PostHogProvider>
        ) : (
          appTree
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
