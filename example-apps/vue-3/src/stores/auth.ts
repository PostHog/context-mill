import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import posthog from 'posthog-js'

export interface User {
  id: string
  username: string
  burritoConsiderations: number
}

// Stands in for your auth system, giving each username a stable UUID like a database primary key.
// Identify with that stable id and send username only in person properties.
export function getUserId(username: string): string {
  const key = `demo-user-id:${username}`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  window.localStorage.setItem(key, id)
  return id
}

const users = new Map<string, User>()

export const useAuthStore = defineStore('auth', () => {
  const getInitialUser = (): User | null => {
    if (typeof window === 'undefined') return null

    const raw = localStorage.getItem('currentUser')
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as Partial<User>
      // Only restore and re-identify when a complete user record with a stable id and username is stored.
      if (
        typeof parsed?.id === 'string' &&
        parsed.id &&
        typeof parsed?.username === 'string' &&
        parsed.username.trim()
      ) {
        const restoredUser: User = {
          id: parsed.id,
          username: parsed.username.trim(),
          burritoConsiderations:
            typeof parsed.burritoConsiderations === 'number' ? parsed.burritoConsiderations : 0,
        }
        users.set(restoredUser.username, restoredUser)
        posthog.identify(restoredUser.id, { username: restoredUser.username })
        return restoredUser
      }
    } catch {
      // Ignore malformed or legacy localStorage entries
    }

    localStorage.removeItem('currentUser')
    return null
  }

  const user = ref<User | null>(getInitialUser())

  const isAuthenticated = computed(() => user.value !== null)

  const login = async (username: string, password: string): Promise<boolean> => {
    const trimmedUsername = username.trim()
    // Reject blank credentials so we never identify or capture login events without a valid user identity.
    if (!trimmedUsername || !password) {
      return false
    }

    let localUser = users.get(trimmedUsername)
    if (!localUser) {
      localUser = {
        id: getUserId(trimmedUsername),
        username: trimmedUsername,
        burritoConsiderations: 0,
      }
      users.set(trimmedUsername, localUser)
    }

    user.value = localUser
    localStorage.setItem('currentUser', JSON.stringify(localUser))

    return true
  }

  const logout = () => {
    user.value = null
    localStorage.removeItem('currentUser')
  }

  const setUser = (newUser: User) => {
    user.value = newUser
    users.set(newUser.username, newUser)
    localStorage.setItem('currentUser', JSON.stringify(newUser))
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    setUser,
  }
})
