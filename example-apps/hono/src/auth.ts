import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { randomUUID } from 'node:crypto'

export interface User {
  id: string
  username: string
}

// In-memory users and sessions stand in for a real database and session store.
const users = new Map<string, User>()
const sessions = new Map<string, User>()

export const authMiddleware = createMiddleware<{ Variables: { user?: User } }>(async (c, next) => {
  const sessionId = getCookie(c, 'session')
  const user = sessionId ? sessions.get(sessionId) : undefined
  if (user) c.set('user', user)
  await next()
})

export function login(c: Context, username: string): User {
  let user = users.get(username)
  if (!user) {
    user = { id: randomUUID(), username }
    users.set(username, user)
  }
  const sessionId = randomUUID()
  sessions.set(sessionId, user)
  setCookie(c, 'session', sessionId, { httpOnly: true, sameSite: 'Lax', path: '/' })
  return user
}

export function logout(c: Context): void {
  const sessionId = getCookie(c, 'session')
  if (sessionId) sessions.delete(sessionId)
  deleteCookie(c, 'session', { path: '/' })
}
