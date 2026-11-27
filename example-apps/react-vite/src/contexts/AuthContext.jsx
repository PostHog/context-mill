import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { usePostHog } from '@posthog/react'

const AuthContext = createContext(undefined)

const CURRENT_USER_KEY = 'currentUser'
const DEMO_USERS_KEY = 'demoUsers'

function isValidStoredUser(value) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    typeof value.username === 'string' &&
    value.username.trim().length > 0 &&
    typeof value.burritoConsiderations === 'number'
  )
}

function readDemoUsers() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEMO_USERS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveDemoUser(user) {
  if (typeof window === 'undefined') return
  const users = readDemoUsers()
  users[user.username] = user
  window.localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users))
}

function readCurrentUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!isValidStoredUser(parsed)) return null
    return {
      id: parsed.id.trim(),
      username: parsed.username.trim(),
      burritoConsiderations: parsed.burritoConsiderations,
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const posthog = usePostHog()
  const [user, setUser] = useState(() => readCurrentUser())
  const initialUserRef = useRef(user)
  const [page, setPage] = useState('home')

  useEffect(() => {
    const restoredUser = initialUserRef.current
    // Re-identify with the stored stable user ID when restoring an authenticated session.
    // Skip identify when no stored session exists rather than using a fallback ID.
    if (restoredUser) {
      posthog?.identify(restoredUser.id, { username: restoredUser.username })
    }
  }, [posthog])

  const login = async (username, password) => {
    // Trim username and reject blank credentials so we never identify or capture with an empty ID.
    const trimmedUsername = typeof username === 'string' ? username.trim() : ''
    if (!trimmedUsername || !password) return false

    const demoUsers = readDemoUsers()
    const existingUser = demoUsers[trimmedUsername]
    const isNewUser = !isValidStoredUser(existingUser)

    const localUser = isNewUser
      ? {
          id: crypto.randomUUID(),
          username: trimmedUsername,
          burritoConsiderations: 0,
        }
      : {
          id: existingUser.id.trim(),
          username: trimmedUsername,
          burritoConsiderations: existingUser.burritoConsiderations,
        }

    saveDemoUser(localUser)
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser))
    setUser(localUser)

    // Identify with the stable UUID primary key and pass username only as a person property.
    posthog?.identify(localUser.id, { username: localUser.username })
    // Keep PII such as username out of event properties.
    posthog?.capture('user_logged_in', { is_new_user: isNewUser })

    return true
  }

  const logout = () => {
    setUser(null)
    setPage('home')
    window.localStorage.removeItem(CURRENT_USER_KEY)
  }

  const setUserState = (newUser) => {
    setUser(newUser)
    saveDemoUser(newUser)
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser))
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser: setUserState, page, setPage }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
