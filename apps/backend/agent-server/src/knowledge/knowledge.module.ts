import { Module } from '@nestjs/common';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeAuthService } from './knowledge-auth.service';
import { KnowledgeEvalService } from './knowledge-eval.service';
import type { KnowledgeVectorStore } from './interfaces/knowledge-ingestion.types';
import type { KnowledgeSqlClient } from './repositories/knowledge-sql-client';
import {
  KNOWLEDGE_ADMIN_AUTHENTICATOR,
  PostgresKnowledgeAdminAuthenticator,
  type KnowledgeAdminAuthenticator
} from './knowledge-admin-authenticator';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';
import { KnowledgeObservabilityService } from './knowledge-observability.service';
import type { KnowledgeProviderConfig } from './knowledge-provider.config';
import {
  KNOWLEDGE_PROVIDER_CONFIG,
  KNOWLEDGE_SQL_CLIENT,
  KNOWLEDGE_VECTOR_STORE,
  createKnowledgeProviderProviders
} from './knowledge-provider.module';
import { KnowledgeRagService } from './knowledge-rag.service';
import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from './repositories/knowledge.repository';
import {
  KNOWLEDGE_SESSION_REPOSITORY,
  type KnowledgeSessionRepository
} from './repositories/knowledge-session.repository';

@Module({
  controllers: [KnowledgeController],
  providers: [
    ...createKnowledgeProviderProviders(),
    {
      provide: KNOWLEDGE_ADMIN_AUTHENTICATOR,
      useFactory: (config: KnowledgeProviderConfig, sqlClient: KnowledgeSqlClient | undefined) => {
        if (config.repository.kind !== 'postgres') {
          return undefined;
        }
        if (!sqlClient) {
          throw new Error('Knowledge SQL client is required for database-backed knowledge auth.');
        }
        return new PostgresKnowledgeAdminAuthenticator(sqlClient);
      },
      inject: [KNOWLEDGE_PROVIDER_CONFIG, KNOWLEDGE_SQL_CLIENT]
    },
    {
      provide: KnowledgeAuthService,
      useFactory: (sessions: KnowledgeSessionRepository, adminAuthenticator: KnowledgeAdminAuthenticator | undefined) =>
        new KnowledgeAuthService({ sessions, adminAuthenticator }),
      inject: [KNOWLEDGE_SESSION_REPOSITORY, KNOWLEDGE_ADMIN_AUTHENTICATOR]
    },
    {
      provide: KnowledgeIngestionService,
      useFactory: (repo: KnowledgeRepository, vectorStore: KnowledgeVectorStore) =>
        new KnowledgeIngestionService({ repo, vectorStore }),
      inject: [KNOWLEDGE_REPOSITORY, KNOWLEDGE_VECTOR_STORE]
    },
    {
      provide: KnowledgeRagService,
      useFactory: (repo: KnowledgeRepository) => new KnowledgeRagService({ repo }),
      inject: [KNOWLEDGE_REPOSITORY]
    },
    {
      provide: KnowledgeObservabilityService,
      useFactory: (repo: KnowledgeRepository) => new KnowledgeObservabilityService({ repo }),
      inject: [KNOWLEDGE_REPOSITORY]
    },
    {
      provide: KnowledgeEvalService,
      useFactory: (repo: KnowledgeRepository) => new KnowledgeEvalService({ repo }),
      inject: [KNOWLEDGE_REPOSITORY]
    },
    {
      provide: KnowledgeService,
      useFactory: (
        config: KnowledgeProviderConfig,
        repository: KnowledgeRepository,
        ragService: KnowledgeRagService,
        ingestionService: KnowledgeIngestionService,
        observabilityService: KnowledgeObservabilityService,
        evalService: KnowledgeEvalService
      ) =>
        new KnowledgeService({
          repository,
          ragService,
          ingestionService,
          observabilityService,
          evalService,
          fixtureFallback: config.repository.kind === 'memory'
        }),
      inject: [
        KNOWLEDGE_PROVIDER_CONFIG,
        KNOWLEDGE_REPOSITORY,
        KnowledgeRagService,
        KnowledgeIngestionService,
        KnowledgeObservabilityService,
        KnowledgeEvalService
      ]
    }
  ]
})
export class KnowledgeModule {}
