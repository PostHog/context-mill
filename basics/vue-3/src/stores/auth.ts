import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface User {
  username: string
  burritoConsiderations: number
}

const users = new Map<string, User>()

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(() => {
    if (typeof window === 'undefined') return null

    const storedUsername = localStorage.getItem('currentUser')
    if (storedUsername) {
      const existingUser = users.get(storedUsername)
      if (existingUser && existingUser.username) {
        return existingUser
      } else {
        // Clean up invalid state
        localStorage.removeItem('currentUser')
      }
    }
    return null
  })

  const isAuthenticated = computed(() => user.value !== null)

  const login = async (username: string, password: string): Promise<boolean> => {
    // Client-side only fake auth - no server calls
    if (!username || !password) {
      return false
    }

    let localUser = users.get(username)
    if (!localUser) {
      localUser = {
        username,
        burritoConsiderations: 0
      }
      users.set(username, localUser)
    }

    user.value = localUser
    localStorage.setItem('currentUser', username)

    return true
  }

  const logout = () => {
    user.value = null
    localStorage.removeItem('currentUser')
  }

  const setUser = (newUser: User) => {
    user.value = newUser
    users.set(newUser.username, newUser)
  }

  return {
    user,
    isAuthenticated,
    login,
    logout,
    setUser
  }
})
