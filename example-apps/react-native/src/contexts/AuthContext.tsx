import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import type PostHog from 'posthog-react-native'
import { usePostHog } from 'posthog-react-native'
import { createUserId, storage, User } from '../services/storage'

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
 * Authentication Provider with PostHog integration.
 *
 * @see https://posthog.com/docs/libraries/react-native#identifying-users
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const posthog: PostHog | undefined = usePostHog()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUsername = (await storage.getCurrentUser())?.trim()
        if (storedUsername) {
          const existingUser = await storage.getUser(storedUsername)
          if (existingUser) {
            setUser(existingUser)

            // Re-identify user in PostHog on session restore so events after restart match login.
            posthog?.identify(existingUser.id, {
              $set: {
                username: existingUser.username,
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

    restoreSession()
  }, [posthog])

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const trimmedUsername = username.trim()
      const trimmedPassword = password.trim()

      // Reject blank credentials before persisting state or calling identify and capture,
      // rather than falling back to a shared placeholder identity.
      if (!trimmedUsername || !trimmedPassword) {
        return false
      }

      try {
        const existingUser = await storage.getUser(trimmedUsername)
        const isNewUser = !existingUser

        const userData: User = existingUser || {
          id: createUserId(),
          username: trimmedUsername,
          burritoConsiderations: 0,
        }

        await storage.saveUser(userData)
        await storage.setCurrentUser(trimmedUsername)
        setUser(userData)

        // Identify with the stable user id as distinct ID and put username in person properties.
        posthog?.identify(userData.id, {
          $set: {
            username: trimmedUsername,
          },
          $set_once: {
            first_login_date: new Date().toISOString(),
          },
        })

        // Keep PII like username out of capture event properties.
        posthog?.capture('user_logged_in', {
          login_method: 'username',
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
    if (!user) {
      return
    }

    // Capture logout event before reset on an authenticated session.
    posthog?.capture('user_logged_out')
    posthog?.reset()

    await storage.removeCurrentUser()
    setUser(null)
  }, [posthog, user])

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
