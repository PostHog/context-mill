// Shared in-memory storage for users (fake, no database)
export const users = new Map<string, { username: string; burritoConsiderations: number }>()

export function getOrCreateUser(username: string): { username: string; burritoConsiderations: number } {
  let user = users.get(username)
  
  if (!user) {
    user = { username, burritoConsiderations: 0 }
    users.set(username, user)
  }
  
  return user
}

export function incrementBurritoConsiderations(username: string): { username: string; burritoConsiderations: number } {
  const user = users.get(username)
  
  if (!user) {
    throw new Error('User not found')
  }
  
  user.burritoConsiderations++
  users.set(username, user)
  
  return { ...user }
}
