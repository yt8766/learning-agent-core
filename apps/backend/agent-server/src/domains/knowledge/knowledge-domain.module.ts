import { Module } from '@nestjs/common';

import { KnowledgeApiController } from '../../api/knowledge/knowledge.controller';
import { LegacyKnowledgeController } from '../../api/knowledge/legacy-knowledge.controller';
import { KnowledgeMemoryRepository } from './repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { KnowledgeDocumentService } from './services/knowledge-document.service';
import { KnowledgeIngestionQueue } from './services/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from './services/knowledge-ingestion.worker';
import { KnowledgeUploadService } from './services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from './storage/in-memory-oss-storage.provider';

@Module({
  controllers: [KnowledgeApiController, LegacyKnowledgeController],
  providers: [
    KnowledgeMemoryRepository,
    InMemoryOssStorageProvider,
    KnowledgeBaseService,
    KnowledgeUploadService,
    KnowledgeDocumentService,
    KnowledgeIngestionWorker,
    KnowledgeIngestionQueue
  ],
  exports: [KnowledgeBaseService, KnowledgeUploadService, KnowledgeDocumentService]
})
export class KnowledgeDomainModule {}
