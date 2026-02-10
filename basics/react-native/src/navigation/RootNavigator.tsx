import React from 'react'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import { colors } from '../styles/theme'

import HomeScreen from '../screens/HomeScreen'
import BurritoScreen from '../screens/BurritoScreen'
import ProfileScreen from '../screens/ProfileScreen'

// Type definitions for navigation
export type RootStackParamList = {
  Home: undefined
  Burrito: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  const { isLoading } = useAuth()

  // Show loading indicator while restoring session
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.headerBackground,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerBackTitleVisible: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Burrito App',
        }}
      />
      <Stack.Screen
        name="Burrito"
        component={BurritoScreen}
        options={{
          title: 'Burrito Consideration',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Stack.Navigator>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
})
