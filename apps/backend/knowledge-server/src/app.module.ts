import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/backend/knowledge-server/.env'],
      isGlobal: true
    }),
    KnowledgeModule
  ],
  controllers: [AppController]
})
export class AppModule {}
