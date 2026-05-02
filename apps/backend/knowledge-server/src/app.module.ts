import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [AppController]
})
export class AppModule {}
