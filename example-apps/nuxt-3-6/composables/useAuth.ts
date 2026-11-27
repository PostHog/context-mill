interface User {
  id: string
  username: string
  burritoConsiderations: number
}

const STORAGE_KEY = 'currentUser'
const users = new Map<string, User>()
let restoredUserId: string | null = null

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<User>
    if (typeof parsed?.id === 'string' && parsed.id.trim() && typeof parsed?.username === 'string' && parsed.username.trim()) {
      return {
        id: parsed.id,
        username: parsed.username,
        burritoConsiderations: typeof parsed.burritoConsiderations === 'number' ? parsed.burritoConsiderations : 0,
      }
    }
  } catch {
    // Ignore legacy or malformed storage values and remove them cleanly.
  }
  localStorage.removeItem(STORAGE_KEY)
  return null
}

export const useAuth = () => {
  const user = useState<User | null>('auth-user', () => readStoredUser())

  // Restore persisted user state on the client after SSR hydration and re-identify with the stable user ID.
  if (typeof window !== 'undefined') {
    if (!user.value) {
      const stored = readStoredUser()
      if (stored) {
        user.value = stored
        users.set(stored.username, stored)
      }
    }
    if (user.value?.id && restoredUserId !== user.value.id) {
      restoredUserId = user.value.id
      const { $posthog } = useNuxtApp()
      $posthog?.identify(user.value.id, { username: user.value.username })
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    const trimmedUsername = username.trim()
    // Reject empty credentials before calling the API or identifying a user.
    if (!trimmedUsername || !password) {
      return false
    }

    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username: trimmedUsername, password },
      })

      if (response.success && response.user?.id) {
        user.value = response.user
        users.set(trimmedUsername, response.user)
        restoredUserId = response.user.id

        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(response.user))
        }

        return true
      }
      return false
    } catch (err) {
      console.error('Login error:', err)
      return false
    }
  }

  const logout = () => {
    user.value = null
    restoredUserId = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const setUser = (newUser: User) => {
    user.value = newUser
    users.set(newUser.username, newUser)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser))
    }
  }

  const incrementBurritoConsiderations = () => {
    if (user.value) {
      const updated = {
        ...user.value,
        burritoConsiderations: user.value.burritoConsiderations + 1,
      }
      user.value = updated
      users.set(updated.username, updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      }
    }
  }

  return {
    user,
    login,
    logout,
    setUser,
    incrementBurritoConsiderations,
  }
}
