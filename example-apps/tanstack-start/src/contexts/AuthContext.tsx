import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { usePostHog } from '@posthog/react'
import type { ReactNode } from 'react'

interface User {
  id: string
  username: string
  burritoConsiderations: number
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  incrementBurritoConsiderations: () => void
}

const STORAGE_KEY = 'currentUser'
const AuthContext = createContext<AuthContextType | undefined>(undefined)
const users: Map<string, User> = new Map()
const isPostHogConfigured = Boolean(
  import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim(),
)

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<User>
    if (
      typeof parsed.id === 'string' &&
      parsed.id.trim() &&
      typeof parsed.username === 'string' &&
      parsed.username.trim()
    ) {
      return {
        id: parsed.id,
        username: parsed.username,
        burritoConsiderations:
          typeof parsed.burritoConsiderations === 'number'
            ? parsed.burritoConsiderations
            : 0,
      }
    }
  } catch {
    // Remove legacy plain-string or malformed storage values cleanly.
  }

  localStorage.removeItem(STORAGE_KEY)
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog()
  const identifiedUserIdRef = useRef<string | null>(null)

  const [user, setUser] = useState<User | null>(() => {
    const stored = readStoredUser()
    if (stored) {
      users.set(stored.username, stored)
    }
    return stored
  })

  // Synchronize a restored localStorage session with PostHog on page reload using the stable user ID.
  useEffect(() => {
    if (!isPostHogConfigured || !user?.id) return
    if (identifiedUserIdRef.current === user.id) return
    identifiedUserIdRef.current = user.id
    posthog.identify(user.id, { username: user.username })
  }, [posthog, user])

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    const trimmedUsername = username.trim()
    // Reject blank credentials before calling the API, identify, or capture instead of falling back.
    if (!trimmedUsername || !password) {
      return false
    }

    try {
      // The session and distinct ID are added automatically by the
      // tracing_headers option configured on the PostHogProvider.
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedUsername, password }),
      })

      if (response.ok) {
        const { user: userData } = await response.json()
        if (!userData?.id) {
          return false
        }

        let localUser = users.get(trimmedUsername)
        if (!localUser) {
          localUser = userData as User
          users.set(trimmedUsername, localUser)
        }

        identifiedUserIdRef.current = localUser.id
        setUser(localUser)
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(localUser))
        }

        if (isPostHogConfigured) {
          // Identify with the stable user ID and keep username in person properties, never in capture event properties.
          posthog.identify(localUser.id, {
            username: trimmedUsername,
          })
          posthog.capture('user_logged_in', {
            login_method: 'username',
          })
        }

        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    // Only capture logout and reset PostHog when transitioning out of an authenticated session.
    if (!user) return

    if (isPostHogConfigured) {
      posthog.capture('user_logged_out')
      posthog.reset()
    }

    identifiedUserIdRef.current = null
    setUser(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const incrementBurritoConsiderations = () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      }
      users.set(updatedUser.username, updatedUser)
      setUser(updatedUser)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser))
      }
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
