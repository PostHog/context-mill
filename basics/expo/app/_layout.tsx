import { Stack, usePathname } from 'expo-router'
import { useEffect, useRef } from 'react'
import { StatusBar } from 'expo-status-bar'
import { PostHogProvider } from 'posthog-react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { AuthProvider } from '../src/contexts/AuthContext'
import { posthog } from '../src/config/posthog'
import { colors } from '../src/styles/theme'

export default function RootLayout() {
  const pathname = usePathname()
  const previousPathname = useRef<string | undefined>(undefined)

  // Manual screen tracking for Expo Router
  // React Compiler will auto-optimize this effect
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      posthog.screen(pathname, {
        previous_screen: previousPathname.current ?? null,
      })
      previousPathname.current = pathname
    }
  }, [pathname])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.headerBackground} />
        <PostHogProvider
          client={posthog}
          autocapture={{
            captureScreens: false, // Manual tracking with Expo Router
            captureTouches: true,
            propsToCapture: ['testID'],
            maxElementsCaptured: 20,
          }}
        >
          <AuthProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.headerBackground },
                headerTintColor: colors.headerText,
                headerTitleStyle: { fontWeight: 'bold' },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="index" options={{ title: 'Burrito App' }} />
              <Stack.Screen name="burrito" options={{ title: 'Burrito Consideration' }} />
              <Stack.Screen name="profile" options={{ title: 'Profile' }} />
            </Stack>
          </AuthProvider>
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
