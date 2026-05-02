import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT ?? 3020);
  const host = process.env.HOST ?? '127.0.0.1';
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.KNOWLEDGE_SERVER_CORS_ORIGIN?.split(',') ?? true,
    credentials: false,
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  });

  await app.listen(port, host);
}

void bootstrap();
