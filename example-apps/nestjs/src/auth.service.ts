import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

export interface User {
  id: string
  username: string
}

// In-memory users and sessions stand in for a real database and session store.
@Injectable()
export class AuthService {
  private readonly users = new Map<string, User>()
  private readonly sessions = new Map<string, User>()

  login(username: string): { user: User; sessionId: string } {
    let user = this.users.get(username)
    if (!user) {
      user = { id: randomUUID(), username }
      this.users.set(username, user)
    }
    const sessionId = randomUUID()
    this.sessions.set(sessionId, user)
    return { user, sessionId }
  }

  logout(sessionId: string | undefined): void {
    if (sessionId) this.sessions.delete(sessionId)
  }

  findBySession(sessionId: string | undefined): User | undefined {
    return sessionId ? this.sessions.get(sessionId) : undefined
  }
}
