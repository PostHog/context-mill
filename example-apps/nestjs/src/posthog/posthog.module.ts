import { Global, Module, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { PostHogInterceptor } from 'posthog-node/nestjs'
import { PostHogService } from './posthog.service.js'
import type { VisitorRequest } from '../visitor.middleware.js'

@Global()
@Module({
  providers: [
    PostHogService,
    {
      // Adds request metadata to events and captures unhandled 5xx errors. getDistinctId ties
      // them to the signed-in user, even for clients that do not send posthog-js tracing headers.
      // Signed-out requests fall through to a personless id.
      provide: APP_INTERCEPTOR,
      inject: [PostHogService],
      useFactory: (posthog: PostHogService): NestInterceptor => {
        // Return a pass-through interceptor when PostHog is unconfigured so requests proceed cleanly.
        if (!posthog.client) {
          return { intercept: (_ctx: ExecutionContext, next: CallHandler) => next.handle() }
        }
        return new PostHogInterceptor(posthog.client, {
          captureExceptions: true,
          getDistinctId: (request: VisitorRequest) => request.visitor?.user?.id,
        })
      },
    },
  ],
  exports: [PostHogService],
})
export class PostHogModule {}
