import { Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { KnowledgeApiController } from '../../api/knowledge/knowledge.controller';
import { KnowledgeSettingsController } from '../../api/knowledge/knowledge-settings.controller';
import { LegacyKnowledgeController } from '../../api/knowledge/legacy-knowledge.controller';
import { KnowledgeMemoryRepository } from './repositories/knowledge-memory.repository';
import { KnowledgeBaseService } from './services/knowledge-base.service';
import { KnowledgeDocumentService } from './services/knowledge-document.service';
import { KnowledgeEvalService } from './services/knowledge-eval.service';
import { KnowledgeFrontendSettingsService } from './services/knowledge-frontend-settings.service';
import { KnowledgeIngestionQueue } from './services/knowledge-ingestion.queue';
import { KnowledgeIngestionWorker } from './services/knowledge-ingestion.worker';
import { KnowledgeProviderHealthService } from './services/knowledge-provider-health.service';
import { KnowledgeUploadService } from './services/knowledge-upload.service';
import { InMemoryOssStorageProvider } from './storage/in-memory-oss-storage.provider';

@Module({
  controllers: [KnowledgeApiController, LegacyKnowledgeController, KnowledgeSettingsController],
  providers: [
    KnowledgeMemoryRepository,
    InMemoryOssStorageProvider,
    KnowledgeBaseService,
    KnowledgeUploadService,
    KnowledgeDocumentService,
    KnowledgeIngestionWorker,
    KnowledgeIngestionQueue,
    {
      provide: KnowledgeProviderHealthService,
      useFactory: () => new KnowledgeProviderHealthService()
    },
    KnowledgeFrontendSettingsService,
    {
      provide: KnowledgeEvalService,
      useFactory: () =>
        new KnowledgeEvalService({
          answer: async ({ question }) => ({
            id: `knowledge_eval_placeholder_${Buffer.from(question).toString('base64url').slice(0, 12)}`,
            citations: []
          })
        })
    }
  ],
  exports: [
    KnowledgeBaseService,
    KnowledgeUploadService,
    KnowledgeDocumentService,
    KnowledgeProviderHealthService,
    KnowledgeFrontendSettingsService,
    KnowledgeEvalService
  ]
})
export class KnowledgeDomainModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly queue: KnowledgeIngestionQueue) {}

  onModuleInit(): void {
    this.queue.start();
  }

  onModuleDestroy(): void {
    this.queue.stop();
  }
}
