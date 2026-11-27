import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common'
import type { Response } from 'express'
import { AuthService } from './auth.service.js'
import { PostHogService } from './posthog/posthog.service.js'
import type { VisitorRequest } from './visitor.middleware.js'

@Controller()
export class AppController {
  constructor(
    @Inject(PostHogService) private readonly posthog: PostHogService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get()
  home(@Req() req: VisitorRequest) {
    return {
      message: 'Burrito API. POST /login, POST /burrito, GET /dashboard, GET /profile',
      user: req.visitor.user ?? null,
    }
  }

  // User identification: identify on login with the app's stable user UUID.
  @Post('login')
  @HttpCode(200)
  login(
    @Body() body: { username?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Reject blank usernames before creating a session, identifying, or capturing
    // so missing identity never falls back to a placeholder user.
    const username = body?.username?.trim()
    if (!username) {
      res.status(400)
      return { error: 'username is required' }
    }

    const { user, sessionId } = this.auth.login(username)
    res.cookie('session', sessionId, { httpOnly: true, sameSite: 'lax' })

    this.posthog.client?.identify({
      distinctId: user.id,
      properties: { username: user.username },
    })
    this.posthog.client?.capture({
      distinctId: user.id,
      event: 'user_logged_in',
      properties: { login_method: 'username' },
    })

    return { user }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Req() req: VisitorRequest, @Res({ passthrough: true }) res: Response) {
    if (req.visitor.user) {
      this.posthog.client?.capture({
        distinctId: req.visitor.user.id,
        event: 'user_logged_out',
      })
    }
    this.auth.logout(req.cookies?.session)
    res.clearCookie('session')
  }

  // Custom event.
  @Post('burrito')
  @HttpCode(200)
  burrito(@Req() req: VisitorRequest) {
    this.posthog.client?.capture({
      distinctId: req.visitor.distinctId,
      event: 'burrito_considered',
      properties: { source: 'api' },
      options: req.visitor.options,
    })

    return { considered: true }
  }

  // Feature flag.
  @Get('dashboard')
  async dashboard(@Req() req: VisitorRequest) {
    let newDashboard = false
    try {
      const flags = await this.posthog.client?.evaluateFlags(req.visitor.distinctId)
      newDashboard = flags?.isEnabled('new-dashboard-feature') ?? false
    } catch (error) {
      console.warn('Feature flag evaluation failed', error)
    }

    return { newDashboard }
  }

  // Error tracking: the PostHog interceptor captures this unhandled error.
  @Get('profile')
  profile(): never {
    throw new Error('Profile lookup failed')
  }
}
