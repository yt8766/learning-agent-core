import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveKnowledgeCorsOrigins } from './config/knowledge-cors.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3020);
  const host = process.env.HOST ?? '127.0.0.1';
  const apiPrefix = process.env.API_PREFIX ?? 'api';
  const corsOrigins = resolveKnowledgeCorsOrigins({
    nodeEnv: process.env.NODE_ENV,
    knowledgeServerCorsOrigin: process.env.KNOWLEDGE_SERVER_CORS_ORIGIN,
    corsOrigins: process.env.CORS_ORIGINS
  });

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: corsOrigins,
    credentials: false,
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
  });

  await app.listen(port, host);
}

void bootstrap();
