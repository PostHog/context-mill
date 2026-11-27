import React, { createContext, useState, useEffect, use } from 'react'
import type { ReactNode } from 'react'
import type PostHog from 'posthog-react-native'
import { usePostHog } from 'posthog-react-native'
import { createUserId, storage } from '../services/storage'
import type { User } from '../services/storage'

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
            // Re-identify restored sessions with the persisted user id so events after reload match login.
            posthog?.identify(existingUser.id, {
              $set: { username: existingUser.username },
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

  // React Compiler auto-memoizes these callbacks, so manual useCallback is unnecessary.
  const login = async (username: string, password: string): Promise<boolean> => {
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

      posthog?.identify(userData.id, {
        $set: { username: trimmedUsername },
        $set_once: { first_login_date: new Date().toISOString() },
      })

      // Keep PII like username out of capture event properties since person properties already store it.
      posthog?.capture('user_logged_in', {
        login_method: 'username',
        is_new_user: isNewUser,
      })

      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = async () => {
    if (!user) return
    posthog?.capture('user_logged_out')
    posthog?.reset()
    await storage.removeCurrentUser()
    setUser(null)
  }

  const incrementBurritoConsiderations = async () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      }
      setUser(updatedUser)
      await storage.saveUser(updatedUser)
    }
  }

  return (
    <AuthContext
      value={{
        user,
        isLoading,
        login,
        logout,
        incrementBurritoConsiderations,
      }}
    >
      {children}
    </AuthContext>
  )
}

/**
 * React 19: Use the `use` API instead of useContext.
 */
export function useAuth() {
  const context = use(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
