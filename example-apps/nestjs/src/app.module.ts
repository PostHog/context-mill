import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { AppController } from './app.controller.js'
import { AuthService } from './auth.service.js'
import { PostHogModule } from './posthog/posthog.module.js'
import { VisitorMiddleware } from './visitor.middleware.js'

@Module({
  imports: [PostHogModule],
  controllers: [AppController],
  providers: [AuthService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(VisitorMiddleware).forRoutes('{*path}')
  }
}
