import React, { createContext, useState, useEffect, use } from 'react'
import type { ReactNode } from 'react'
import { usePostHog } from 'posthog-react-native'
import { storage } from '../services/storage'
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
  const posthog = usePostHog()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedUsername = await storage.getCurrentUser()
        if (storedUsername) {
          const existingUser = await storage.getUser(storedUsername)
          if (existingUser) {
            setUser(existingUser)
            posthog.identify(storedUsername, {
              $set: { username: storedUsername },
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

  // React Compiler auto-memoizes these callbacks - no useCallback needed!
  const login = async (username: string, password: string): Promise<boolean> => {
    if (!username.trim() || !password.trim()) {
      return false
    }

    try {
      const existingUser = await storage.getUser(username)
      const isNewUser = !existingUser

      const userData: User = existingUser || {
        username,
        burritoConsiderations: 0,
      }

      await storage.saveUser(userData)
      await storage.setCurrentUser(username)
      setUser(userData)

      posthog.identify(username, {
        $set: { username },
        $set_once: { first_login_date: new Date().toISOString() },
      })

      posthog.capture('user_logged_in', {
        username,
        is_new_user: isNewUser,
      })

      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = async () => {
    posthog.capture('user_logged_out')
    posthog.reset()
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
 * React 19: Use the `use` API instead of useContext
 * - Can be called conditionally (unlike useContext)
 * - Enables more flexible component composition
 */
export function useAuth() {
  const context = use(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
