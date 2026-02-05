import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react'
import { usePostHog } from '@posthog/react'

interface User {
  username: string
  burritoConsiderations: number
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  incrementBurritoConsiderations: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const users: Map<string, User> = new Map()

export function AuthProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog()

  // Use lazy initializer to read from localStorage only once on mount
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null

    const storedUsername = localStorage.getItem('currentUser')
    if (storedUsername) {
      const existingUser = users.get(storedUsername)
      if (existingUser) {
        return existingUser
      }
    }
    return null
  })

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PostHog-Session-Id': posthog.get_session_id() ?? '',
        },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const { user: userData } = await response.json()

        // Get or create user in local map
        let localUser = users.get(username)
        if (!localUser) {
          localUser = userData as User
          users.set(username, localUser)
        }

        setUser(localUser)
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentUser', username)
        }

        // Identify user in PostHog using username as distinct ID
        posthog.identify(username, {
          username: username,
        })

        // Capture login event
        posthog.capture('user_logged_in', {
          username: username,
        })

        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    // Capture logout event before resetting
    posthog.capture('user_logged_out')
    posthog.reset()

    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser')
    }
  }

  const incrementBurritoConsiderations = () => {
    if (user) {
      user.burritoConsiderations++
      users.set(user.username, user)
      setUser({ ...user })
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, incrementBurritoConsiderations }}
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
