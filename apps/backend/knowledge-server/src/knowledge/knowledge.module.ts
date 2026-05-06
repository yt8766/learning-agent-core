import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenVerifier } from '../auth/auth-token-verifier';
import { KnowledgeFrontendSettingsController } from './knowledge-frontend-settings.controller';
import { KnowledgeFrontendSettingsService } from './knowledge-frontend-settings.service';
import { KnowledgeFrontendMvpController } from './knowledge-frontend-mvp.controller';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeEvalService } from './knowledge-eval.service';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { KnowledgeIngestionQueue } from './knowledge-ingestion.queue';
import { KnowledgeProviderHealthService } from './knowledge-provider-health.service';
import { KnowledgeRagService } from './knowledge-rag.service';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeTraceService } from './knowledge-trace.service';
import { KnowledgeUploadService } from './knowledge-upload.service';
import { KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_REPOSITORY, KNOWLEDGE_SDK_RUNTIME } from './knowledge.tokens';
import { KnowledgeRagModelProfileService } from './rag/knowledge-rag-model-profile.service';
import type { KnowledgeRepository } from './repositories/knowledge.repository';
import { createKnowledgeRepositoryProvider } from './runtime/knowledge-repository.provider';
import {
  createKnowledgeSdkRuntimeProvider,
  type KnowledgeSdkRuntimeProviderValue
} from './runtime/knowledge-sdk-runtime.provider';
import { createAliyunOssStorageProviderFromEnv, describeAliyunOssEnv } from './storage/aliyun-oss-storage.provider';
import { InMemoryOssStorageProvider } from './storage/in-memory-oss-storage.provider';
import type { OssStorageProvider } from './storage/oss-storage.provider';

@Module({
  controllers: [KnowledgeController, KnowledgeFrontendMvpController, KnowledgeFrontendSettingsController],
  providers: [
    createKnowledgeRepositoryProvider(),
    createKnowledgeSdkRuntimeProvider(),
    {
      provide: KnowledgeService,
      useFactory: (repository: KnowledgeRepository) => new KnowledgeService(repository),
      inject: [KNOWLEDGE_REPOSITORY]
    },
    {
      provide: KNOWLEDGE_OSS_STORAGE,
      useFactory: () => {
        const aliyunStorage = createAliyunOssStorageProviderFromEnv(process.env);
        if (aliyunStorage) {
          Logger.log(
            `Knowledge OSS storage provider: aliyun (${describeAliyunOssEnv(process.env)})`,
            'KnowledgeModule'
          );
          return aliyunStorage;
        }
        Logger.warn('Knowledge OSS storage provider: memory (ALIYUN_OSS_* not configured)', 'KnowledgeModule');
        return new InMemoryOssStorageProvider();
      }
    },
    {
      provide: KnowledgeUploadService,
      useFactory: (repository: KnowledgeRepository, storage: OssStorageProvider) =>
        new KnowledgeUploadService(repository, storage),
      inject: [KNOWLEDGE_REPOSITORY, KNOWLEDGE_OSS_STORAGE]
    },
    {
      provide: KnowledgeIngestionWorker,
      useFactory: (
        repository: KnowledgeRepository,
        storage: OssStorageProvider,
        sdkRuntime: KnowledgeSdkRuntimeProviderValue
      ) => new KnowledgeIngestionWorker(repository, storage, sdkRuntime),
      inject: [KNOWLEDGE_REPOSITORY, KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_SDK_RUNTIME]
    },
    {
      provide: KnowledgeIngestionQueue,
      useFactory: (worker: KnowledgeIngestionWorker) => new KnowledgeIngestionQueue(worker),
      inject: [KnowledgeIngestionWorker]
    },
    {
      provide: KnowledgeDocumentService,
      useFactory: (
        repository: KnowledgeRepository,
        queue: KnowledgeIngestionQueue,
        storage: OssStorageProvider,
        sdkRuntime: KnowledgeSdkRuntimeProviderValue,
        ragService: KnowledgeRagService,
        modelProfiles: KnowledgeRagModelProfileService
      ) => new KnowledgeDocumentService(repository, queue, storage, sdkRuntime, ragService, modelProfiles),
      inject: [
        KNOWLEDGE_REPOSITORY,
        KnowledgeIngestionQueue,
        KNOWLEDGE_OSS_STORAGE,
        KNOWLEDGE_SDK_RUNTIME,
        KnowledgeRagService,
        KnowledgeRagModelProfileService
      ]
    },
    {
      provide: KnowledgeTraceService,
      useFactory: () => new KnowledgeTraceService()
    },
    {
      provide: KnowledgeProviderHealthService,
      useFactory: () => new KnowledgeProviderHealthService()
    },
    {
      provide: KnowledgeFrontendSettingsService,
      useFactory: () => new KnowledgeFrontendSettingsService()
    },
    {
      provide: KnowledgeRagService,
      useFactory: (
        repository: KnowledgeRepository,
        sdkRuntime: KnowledgeSdkRuntimeProviderValue,
        traces: KnowledgeTraceService
      ) => new KnowledgeRagService(repository, sdkRuntime, traces),
      inject: [KNOWLEDGE_REPOSITORY, KNOWLEDGE_SDK_RUNTIME, KnowledgeTraceService]
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
    },
    {
      provide: KnowledgeEvalService,
      useFactory: (rag: KnowledgeRagService) =>
        new KnowledgeEvalService({
          answer: async ({ question }) => {
            const response = await rag.answer(
              { userId: 'eval-system' },
              { conversationId: `eval_${Date.now()}`, message: question }
            );
            return {
              id: response.assistantMessage.id,
              citations: response.citations,
              traceId: response.traceId
            };
          }
        }),
      inject: [KnowledgeRagService]
    },
    {
      provide: AuthTokenVerifier,
      useFactory: () =>
        new AuthTokenVerifier({
          secret: process.env.AUTH_SERVER_JWT_SECRET ?? 'local-dev-auth-secret',
          issuer: process.env.AUTH_SERVER_JWT_ISSUER ?? 'auth-server',
          audience: process.env.AUTH_SERVER_JWT_AUDIENCE ?? 'knowledge'
        })
    },
    AuthGuard
  ]
})
export class KnowledgeModule implements OnModuleInit {
  constructor(private readonly queue: KnowledgeIngestionQueue) {}

  onModuleInit(): void {
    this.queue.start();
  }
}

function readModelEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}
