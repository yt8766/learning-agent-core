import { Logger, Module } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthTokenVerifier } from '../auth/auth-token-verifier';
import { KnowledgeFrontendMvpController } from './knowledge-frontend-mvp.controller';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeDocumentService } from './knowledge-document.service';
import { KnowledgeIngestionWorker } from './knowledge-ingestion.worker';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeUploadService } from './knowledge-upload.service';
import { KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_REPOSITORY, KNOWLEDGE_SDK_RUNTIME } from './knowledge.tokens';
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
  controllers: [KnowledgeController, KnowledgeFrontendMvpController],
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
      provide: KnowledgeDocumentService,
      useFactory: (
        repository: KnowledgeRepository,
        worker: KnowledgeIngestionWorker,
        storage: OssStorageProvider,
        sdkRuntime: KnowledgeSdkRuntimeProviderValue
      ) => new KnowledgeDocumentService(repository, worker, storage, sdkRuntime),
      inject: [KNOWLEDGE_REPOSITORY, KnowledgeIngestionWorker, KNOWLEDGE_OSS_STORAGE, KNOWLEDGE_SDK_RUNTIME]
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
export class KnowledgeModule {}
