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
import { KnowledgeRagModelProfileService } from './services/knowledge-rag-model-profile.service';
import { KnowledgeRagService } from './services/knowledge-rag.service';
import { KnowledgeTraceService } from './services/knowledge-trace.service';
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
    },
    {
      provide: KnowledgeTraceService,
      useFactory: () => new KnowledgeTraceService()
    },
    {
      provide: KnowledgeRagService,
      useFactory: (repository: KnowledgeMemoryRepository, traces: KnowledgeTraceService) =>
        new KnowledgeRagService(repository, traces),
      inject: [KnowledgeMemoryRepository, KnowledgeTraceService]
    },
    {
      provide: KnowledgeRagModelProfileService,
      useFactory: () =>
        new KnowledgeRagModelProfileService({
          profiles: [
            {
              id: 'coding-pro',
              label: '用于编程',
              description: '更专业的回答与控制',
              useCase: 'coding',
              plannerModelId: readModelEnv(
                'KNOWLEDGE_PLANNER_MODEL',
                readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat')
              ),
              answerModelId: readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat'),
              embeddingModelId: readModelEnv('KNOWLEDGE_EMBEDDING_MODEL', 'knowledge-embedding'),
              enabled: true
            },
            {
              id: 'daily-balanced',
              label: '适合日常工作',
              description: '同样强大，技术细节更少',
              useCase: 'daily',
              plannerModelId: readModelEnv(
                'KNOWLEDGE_PLANNER_MODEL',
                readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat')
              ),
              answerModelId: readModelEnv('KNOWLEDGE_CHAT_MODEL', 'knowledge-chat'),
              embeddingModelId: readModelEnv('KNOWLEDGE_EMBEDDING_MODEL', 'knowledge-embedding'),
              enabled: true
            }
          ]
        })
    }
  ],
  exports: [
    KnowledgeBaseService,
    KnowledgeUploadService,
    KnowledgeDocumentService,
    KnowledgeProviderHealthService,
    KnowledgeFrontendSettingsService,
    KnowledgeEvalService,
    KnowledgeTraceService,
    KnowledgeRagModelProfileService,
    KnowledgeRagService
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

function readModelEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}
