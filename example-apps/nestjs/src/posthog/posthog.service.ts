import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { PostHog } from 'posthog-node'

@Injectable()
export class PostHogService implements OnApplicationShutdown {
  private readonly logger = new Logger(PostHogService.name)

  // One client per process, or null when no project token is configured.
  readonly client: PostHog | null

  constructor() {
    // Leave client null when POSTHOG_PROJECT_TOKEN is unset rather than passing
    // an empty string with disabled set to true.
    const token = process.env.POSTHOG_PROJECT_TOKEN?.trim()

    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(
          'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
        )
      }
      this.client = null
      return
    }

    this.client = new PostHog(token, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      enableExceptionAutocapture: true,
    })
  }

  // Runs on SIGINT/SIGTERM when main.ts calls enableShutdownHooks().
  async onApplicationShutdown(): Promise<void> {
    await this.client?.shutdown(3000)
  }
}
