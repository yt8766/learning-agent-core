import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveAuthCorsOrigins } from './config/auth-cors.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3010);
  const host = process.env.HOST ?? '127.0.0.1';
  const apiPrefix = process.env.API_PREFIX ?? 'api';
  const corsOrigins = resolveAuthCorsOrigins({
    nodeEnv: process.env.NODE_ENV,
    authServerCorsOrigin: process.env.AUTH_SERVER_CORS_ORIGIN,
    corsOrigins: process.env.CORS_ORIGINS
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins,
    credentials: false,
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS']
  });

  await app.listen(port, host);
}

void bootstrap();
