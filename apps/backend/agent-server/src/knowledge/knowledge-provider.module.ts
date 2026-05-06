import type { FactoryProvider, OnModuleDestroy, Provider } from '@nestjs/common';
import { Pool } from 'pg';

import type { KnowledgeSqlClient } from './repositories/knowledge-sql-client';
import type { KnowledgeVectorStore } from './interfaces/knowledge-ingestion.types';
import { resolveKnowledgeProviderConfig, type KnowledgeProviderConfig } from './knowledge-provider.config';
import { createKnowledgeVectorStore } from './knowledge-vector-store.factory';
import { InMemoryKnowledgeRepository } from './repositories/knowledge-memory.repository';
import { PostgresKnowledgeSessionRepository } from './repositories/knowledge-postgres-session.repository';
import { PostgresKnowledgeRepository } from './repositories/knowledge-postgres.repository';
import {
  InMemoryKnowledgeSessionRepository,
  KNOWLEDGE_SESSION_REPOSITORY,
  type KnowledgeSessionRepository
} from './repositories/knowledge-session.repository';
import { KNOWLEDGE_REPOSITORY, type KnowledgeRepository } from './repositories/knowledge.repository';

export type KnowledgeRepositoryProviderKind = KnowledgeProviderConfig['repository']['kind'];

export const KNOWLEDGE_PROVIDER_CONFIG = Symbol('KNOWLEDGE_PROVIDER_CONFIG');
export const KNOWLEDGE_SQL_CLIENT = Symbol('KNOWLEDGE_SQL_CLIENT');
export const KNOWLEDGE_VECTOR_STORE = Symbol('KNOWLEDGE_VECTOR_STORE');

export class KnowledgeSqlClientLifecycle implements OnModuleDestroy {
  constructor(private readonly sqlClient: KnowledgeSqlClient | undefined) {}

  async onModuleDestroy(): Promise<void> {
    await this.sqlClient?.close?.();
  }
}

export function createKnowledgeRepositoryProviderKind(
  config: KnowledgeProviderConfig
): KnowledgeRepositoryProviderKind {
  return config.repository.kind;
}

export function createKnowledgeProviderConfigProvider(): FactoryProvider<KnowledgeProviderConfig> {
  return {
    provide: KNOWLEDGE_PROVIDER_CONFIG,
    useFactory: () => resolveKnowledgeProviderConfig(process.env)
  };
}

export function createKnowledgeSqlClient(databaseUrl: string): KnowledgeSqlClient {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async query<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]) {
      const result = await pool.query<T>(sql, params ? [...params] : undefined);
      return { rows: result.rows };
    },
    close: () => pool.end()
  };
}

export function createKnowledgeSqlClientProvider(): FactoryProvider<KnowledgeSqlClient | undefined> {
  return {
    provide: KNOWLEDGE_SQL_CLIENT,
    inject: [KNOWLEDGE_PROVIDER_CONFIG],
    useFactory: (config: KnowledgeProviderConfig) => {
      if (config.repository.kind === 'postgres') {
        return createKnowledgeSqlClient(config.repository.databaseUrl);
      }

      return undefined;
    }
  };
}

export function createKnowledgeSqlClientLifecycleProvider(): FactoryProvider<KnowledgeSqlClientLifecycle> {
  return {
    provide: KnowledgeSqlClientLifecycle,
    inject: [KNOWLEDGE_SQL_CLIENT],
    useFactory: (sqlClient: KnowledgeSqlClient | undefined) => new KnowledgeSqlClientLifecycle(sqlClient)
  };
}

export function createKnowledgeRepositoryProvider(): FactoryProvider<KnowledgeRepository> {
  return {
    provide: KNOWLEDGE_REPOSITORY,
    inject: [KNOWLEDGE_PROVIDER_CONFIG, KNOWLEDGE_SQL_CLIENT],
    useFactory: (config: KnowledgeProviderConfig, sqlClient: KnowledgeSqlClient | undefined) => {
      if (config.repository.kind === 'postgres') {
        return new PostgresKnowledgeRepository(requireKnowledgeSqlClient(sqlClient));
      }

      return new InMemoryKnowledgeRepository();
    }
  };
}

export function createKnowledgeSessionRepositoryProvider(): FactoryProvider<KnowledgeSessionRepository> {
  return {
    provide: KNOWLEDGE_SESSION_REPOSITORY,
    inject: [KNOWLEDGE_PROVIDER_CONFIG, KNOWLEDGE_SQL_CLIENT],
    useFactory: (config: KnowledgeProviderConfig, sqlClient: KnowledgeSqlClient | undefined) => {
      if (config.repository.kind === 'postgres') {
        return new PostgresKnowledgeSessionRepository(requireKnowledgeSqlClient(sqlClient));
      }

      return new InMemoryKnowledgeSessionRepository();
    }
  };
}

export function createKnowledgeVectorStoreProvider(): FactoryProvider<KnowledgeVectorStore> {
  return {
    provide: KNOWLEDGE_VECTOR_STORE,
    inject: [KNOWLEDGE_PROVIDER_CONFIG],
    useFactory: (config: KnowledgeProviderConfig) => createKnowledgeVectorStore(config.vectorStore)
  };
}

export function createKnowledgeProviderProviders(): Provider[] {
  return [
    createKnowledgeProviderConfigProvider(),
    createKnowledgeSqlClientProvider(),
    createKnowledgeSqlClientLifecycleProvider(),
    createKnowledgeRepositoryProvider(),
    createKnowledgeSessionRepositoryProvider(),
    createKnowledgeVectorStoreProvider()
  ];
}

function requireKnowledgeSqlClient(sqlClient: KnowledgeSqlClient | undefined): KnowledgeSqlClient {
  if (!sqlClient) {
    throw new Error('Knowledge SQL client is required when KNOWLEDGE_REPOSITORY=postgres.');
  }

  return sqlClient;
}
