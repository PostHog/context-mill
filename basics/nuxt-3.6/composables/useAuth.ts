interface User {
  username: string
  burritoConsiderations: number
}

const users = new Map<string, User>()

export const useAuth = () => {
  const user = useState<User | null>('auth-user', () => {
    if (typeof window !== 'undefined') {
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
    if (!username || !password) {
      return false
    }

    try {
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })

      if (response.success && response.user) {
        // Update client-side state
        user.value = response.user
        users.set(username, response.user)
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentUser', username)
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser')
    }
  }

  const setUser = (newUser: User) => {
    user.value = newUser
    users.set(newUser.username, newUser)
  }

  const incrementBurritoConsiderations = () => {
    if (user.value) {
      user.value.burritoConsiderations++
      users.set(user.value.username, user.value)
      // Trigger reactivity by creating a new object
      user.value = { ...user.value }
    }
  }

  return {
    user,
    login,
    logout,
    setUser,
    incrementBurritoConsiderations
  }
}
