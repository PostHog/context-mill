import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { PostHog } from 'posthog-node'

@Injectable()
export class PostHogService implements OnApplicationShutdown {
  private readonly logger = new Logger(PostHogService.name)

  // One client per process, shared by every request.
  readonly client: PostHog

  constructor() {
    const token = process.env.POSTHOG_PROJECT_TOKEN

    if (!token && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
      )
    }

    // Without a token the client is disabled: capture calls become no-ops.
    this.client = new PostHog(token ?? '', {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      enableExceptionAutocapture: true,
      disabled: !token,
    })
  }

  // Runs on SIGINT/SIGTERM because main.ts calls enableShutdownHooks().
  async onApplicationShutdown(): Promise<void> {
    await this.client.shutdown(3000)
  }
}
