import { Module } from '@nestjs/common';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { InMemoryKnowledgeRepository } from './repositories/knowledge-memory.repository';
import type { KnowledgeRepository } from './repositories/knowledge.repository';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

@Module({
  controllers: [KnowledgeController],
  providers: [
    {
      provide: KNOWLEDGE_REPOSITORY,
      useClass: InMemoryKnowledgeRepository
    },
    {
      provide: KnowledgeService,
      useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository),
      inject: [KNOWLEDGE_REPOSITORY]
    }
  ]
})
export class KnowledgeModule {}
