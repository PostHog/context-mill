import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { usePostHog } from 'posthog-react-native'
import { storage, User } from '../services/storage'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  incrementBurritoConsiderations: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

/**
 * Authentication Provider with PostHog integration
 *
 * Manages user authentication state and integrates with PostHog for:
 * - User identification (posthog.identify)
 * - Login/logout event tracking
 * - Session reset on logout
 *
 * @see https://posthog.com/docs/libraries/react-native#identifying-users
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const posthog = usePostHog()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session on app launch
  useEffect(() => {
    restoreSession()
  }, [])

  const restoreSession = async () => {
    try {
      const storedUsername = await storage.getCurrentUser()
      if (storedUsername) {
        const existingUser = await storage.getUser(storedUsername)
        if (existingUser) {
          setUser(existingUser)

          // Re-identify user in PostHog on session restore
          // This ensures events are correctly attributed after app restart
          posthog.identify(storedUsername, {
            $set: {
              username: storedUsername,
            },
          })
        }
      }
    } catch (error) {
      console.error('Failed to restore session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      // Simple validation (demo app accepts any username/password)
      if (!username.trim() || !password.trim()) {
        return false
      }

      try {
        // Check if user exists or create new
        const existingUser = await storage.getUser(username)
        const isNewUser = !existingUser

        const userData: User = existingUser || {
          username,
          burritoConsiderations: 0,
        }

        // Save user data
        await storage.saveUser(userData)
        await storage.setCurrentUser(username)
        setUser(userData)

        // PostHog identify - use username as distinct ID
        // $set updates properties every time, $set_once only sets if not already set
        // @see https://posthog.com/docs/libraries/react-native#identifying-users
        posthog.identify(username, {
          $set: {
            username: username,
          },
          $set_once: {
            first_login_date: new Date().toISOString(),
          },
        })

        // Capture login event with properties
        // @see https://posthog.com/docs/libraries/react-native#capturing-events
        posthog.capture('user_logged_in', {
          username: username,
          is_new_user: isNewUser,
        })

        return true
      } catch (error) {
        console.error('Login error:', error)
        return false
      }
    },
    [posthog],
  )

  const logout = useCallback(async () => {
    // Capture logout event before reset
    posthog.capture('user_logged_out')

    // Reset PostHog - clears the current user's distinct ID and anonymous ID
    // This should be called when the user logs out
    // @see https://posthog.com/docs/libraries/react-native#reset-after-logout
    posthog.reset()

    await storage.removeCurrentUser()
    setUser(null)
  }, [posthog])

  const incrementBurritoConsiderations = useCallback(async () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      }
      setUser(updatedUser)
      await storage.saveUser(updatedUser)
    }
  }, [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        incrementBurritoConsiderations,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
