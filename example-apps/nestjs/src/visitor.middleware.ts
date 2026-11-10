import { Inject, Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { AuthService } from './auth.service.js'

export interface Visitor {
  distinctId: string
  user?: { id: string; username: string }
  // Signed-out visitors get no person profile.
  properties: Record<string, unknown>
}

export type VisitorRequest = Request & { visitor: Visitor }

// Resolves who is making the request. Signed-in users are identified by their
// own id. Signed-out visitors get a random id that lives for the visit.
@Injectable()
export class VisitorMiddleware implements NestMiddleware {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const user = this.auth.findBySession(req.cookies?.session)

    if (user) {
      ;(req as VisitorRequest).visitor = { distinctId: user.id, user, properties: {} }
    } else {
      let visitId: string | undefined = req.cookies?.visit_id
      if (!visitId) {
        visitId = randomUUID()
        res.cookie('visit_id', visitId, { httpOnly: true, sameSite: 'lax' })
      }
      ;(req as VisitorRequest).visitor = {
        distinctId: visitId,
        properties: { $process_person_profile: false },
      }
    }

    next()
  }
}
