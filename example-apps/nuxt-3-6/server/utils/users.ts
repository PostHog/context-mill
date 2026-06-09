interface User {
  username: string
  burritoConsiderations: number
}

// Shared in-memory storage for users (fake, no database)
export const users = new Map<string, User>()

export function getOrCreateUser(username: string): User {
  let user = users.get(username)
  
  if (!user) {
    user = { 
      username, 
      burritoConsiderations: 0 
    }
    users.set(username, user)
  }
  
  return user
}

export function incrementBurritoConsiderations(username: string): User {
  const user = users.get(username)
  
  if (!user) {
    throw new Error('User not found')
  }
  
  user.burritoConsiderations++
  users.set(username, user)
  
  return { ...user }
}
