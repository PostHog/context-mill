interface User {
  username: string
  burritoConsiderations: number
}

const users: Map<string, User> = new Map()

export function useAuth() {
  const user = useState<User | null>('auth-user', () => {
    if (process.client) {
      const storedUsername = localStorage.getItem('currentUser')
      if (storedUsername) {
        const existingUser = users.get(storedUsername)
        if (existingUser) {
          return existingUser
        }
      }
    }
    return null
  })

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await $fetch<{ success: boolean; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })

      if (response.success) {
        let localUser = users.get(username)
        if (!localUser) {
          localUser = response.user
          users.set(username, localUser)
        }

        user.value = localUser
        if (process.client) {
          localStorage.setItem('currentUser', username)
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
    user.value = null
    if (process.client) {
      localStorage.removeItem('currentUser')
    }
  }

  const incrementBurritoConsiderations = () => {
    if (user.value) {
      user.value.burritoConsiderations++
      users.set(user.value.username, user.value)
      // Trigger reactivity
      user.value = { ...user.value }
    }
  }

  const setUser = (newUser: User) => {
    user.value = newUser
    users.set(newUser.username, newUser)
  }

  return {
    user,
    login,
    logout,
    incrementBurritoConsiderations,
    setUser,
  }
}
