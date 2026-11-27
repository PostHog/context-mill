import AsyncStorage from '@react-native-async-storage/async-storage'

const CURRENT_USER_KEY = 'currentUser'
const USERS_KEY = 'users'

export interface User {
  id: string
  username: string
  burritoConsiderations: number
}

// Stands in for your auth system: each username keeps a stable user id, the way a user
// record's primary key would. Identify with that id, never with the username or email.
// React Native has no crypto.randomUUID, so the id joins the time and a random part.
export function createUserId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Storage service for persisting user data
 * Uses AsyncStorage (React Native's async key-value storage)
 */
export const storage = {
  /**
   * Get the currently logged in user's username
   */
  getCurrentUser: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(CURRENT_USER_KEY)
    } catch (error) {
      console.error('Error getting current user:', error)
      return null
    }
  },

  /**
   * Set the currently logged in user's username
   */
  setCurrentUser: async (username: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(CURRENT_USER_KEY, username)
    } catch (error) {
      console.error('Error setting current user:', error)
    }
  },

  /**
   * Remove the current user (logout)
   */
  removeCurrentUser: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY)
    } catch (error) {
      console.error('Error removing current user:', error)
    }
  },

  /**
   * Get all stored users
   */
  getUsers: async (): Promise<Record<string, User>> => {
    try {
      const data = await AsyncStorage.getItem(USERS_KEY)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.error('Error getting users:', error)
      return {}
    }
  },

  /**
   * Get a specific user by username
   */
  getUser: async (username: string): Promise<User | null> => {
    try {
      const users = await storage.getUsers()
      const user = users[username]
      if (!user) return null

      // Users saved before ids existed get one now, so a restored session never identifies as undefined
      if (!user.id) {
        user.id = createUserId()
        await storage.saveUser(user)
      }

      return user
    } catch (error) {
      console.error('Error getting user:', error)
      return null
    }
  },

  /**
   * Save a user to storage
   */
  saveUser: async (user: User): Promise<void> => {
    try {
      const users = await storage.getUsers()
      users[user.username] = user
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users))
    } catch (error) {
      console.error('Error saving user:', error)
    }
  },

  /**
   * Clear all stored data (for testing/debugging)
   */
  clearAll: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([CURRENT_USER_KEY, USERS_KEY])
    } catch (error) {
      console.error('Error clearing storage:', error)
    }
  },
}
