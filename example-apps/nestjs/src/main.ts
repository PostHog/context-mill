import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.use(cookieParser())

  // Lets PostHogService flush queued events when the process is stopped.
  app.enableShutdownHooks()

  await app.listen(process.env.PORT ?? 3000)
}

bootstrap()
