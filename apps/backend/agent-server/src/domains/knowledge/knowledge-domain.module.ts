import { Module } from '@nestjs/common';

import { KnowledgeApiController } from '../../api/knowledge/knowledge.controller';
import { LegacyKnowledgeController } from '../../api/knowledge/legacy-knowledge.controller';
import { KnowledgeBaseService } from './services/knowledge-base.service';

@Module({
  controllers: [KnowledgeApiController, LegacyKnowledgeController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService]
})
export class KnowledgeDomainModule {}
