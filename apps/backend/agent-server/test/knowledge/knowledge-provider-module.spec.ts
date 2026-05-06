import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeModule } from '../../src/knowledge/knowledge.module';
import {
  KNOWLEDGE_PROVIDER_CONFIG,
  KNOWLEDGE_SQL_CLIENT,
  KNOWLEDGE_VECTOR_STORE,
  KnowledgeSqlClientLifecycle,
  createKnowledgeProviderConfigProvider,
  createKnowledgeProviderProviders,
  createKnowledgeRepositoryProvider,
  createKnowledgeRepositoryProviderKind,
  createKnowledgeSqlClientLifecycleProvider,
  createKnowledgeSqlClientProvider,
  createKnowledgeSessionRepositoryProvider,
  createKnowledgeVectorStoreProvider
} from '../../src/knowledge/knowledge-provider.module';
import type { KnowledgeProviderConfig } from '../../src/knowledge/knowledge-provider.config';
import type { KnowledgeSqlClient } from '../../src/knowledge/repositories/knowledge-sql-client';
import type { KnowledgeVectorStore } from '../../src/knowledge/interfaces/knowledge-ingestion.types';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';
import {
  InMemoryKnowledgeSessionRepository,
  KNOWLEDGE_SESSION_REPOSITORY
} from '../../src/knowledge/repositories/knowledge-session.repository';
import { PostgresKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-postgres-session.repository';
import { KNOWLEDGE_REPOSITORY } from '../../src/knowledge/repositories/knowledge.repository';

describe('knowledge provider module wiring', () => {
  const memoryConfig: KnowledgeProviderConfig = {
    repository: { kind: 'memory' },
    vectorStore: { kind: 'memory' }
  };

  const postgresConfig: KnowledgeProviderConfig = {
    repository: { kind: 'postgres', databaseUrl: 'postgres://localhost/knowledge' },
    vectorStore: { kind: 'memory' }
  };

  it('keeps memory as the explicit default provider', () => {
    expect(createKnowledgeRepositoryProviderKind(memoryConfig)).toBe('memory');
  });

  it('selects postgres repository when configured', () => {
    expect(createKnowledgeRepositoryProviderKind(postgresConfig)).toBe('postgres');
  });

  it('reads provider config from process.env', () => {
    const provider = createKnowledgeProviderConfigProvider();
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousVectorStore = process.env.KNOWLEDGE_VECTOR_STORE;
    const previousDatabaseUrl = process.env.DATABASE_URL;

    try {
      delete process.env.KNOWLEDGE_REPOSITORY;
      delete process.env.KNOWLEDGE_VECTOR_STORE;
      delete process.env.DATABASE_URL;

      expect(provider).toMatchObject({ provide: KNOWLEDGE_PROVIDER_CONFIG });
      expect(provider.useFactory()).toEqual(memoryConfig);
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('KNOWLEDGE_VECTOR_STORE', previousVectorStore);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('keeps postgres DATABASE_URL validation in the config parser', () => {
    const provider = createKnowledgeProviderConfigProvider();
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousDatabaseUrl = process.env.DATABASE_URL;

    try {
      process.env.KNOWLEDGE_REPOSITORY = 'postgres';
      delete process.env.DATABASE_URL;

      expect(() => provider.useFactory()).toThrow('DATABASE_URL is required when KNOWLEDGE_REPOSITORY=postgres');
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('uses Symbol repository tokens instead of string tokens', () => {
    const providers = createKnowledgeProviderProviders();
    const tokens = providers.map(provider => ('provide' in provider ? provider.provide : provider));

    expect(tokens).toContain(KNOWLEDGE_SQL_CLIENT);
    expect(tokens).toContain(KNOWLEDGE_REPOSITORY);
    expect(tokens).toContain(KNOWLEDGE_SESSION_REPOSITORY);
    expect(tokens).toContain(KNOWLEDGE_VECTOR_STORE);
    expect(tokens).not.toContain('KnowledgeRepository');
    expect(tokens).not.toContain('KnowledgeSessionRepository');
    expect(tokens).not.toContain('KnowledgeSqlClient');
    expect(tokens).not.toContain('KnowledgeVectorStore');
  });

  it('creates memory repositories without requiring DATABASE_URL or a SQL client', () => {
    const sqlClientProvider = createKnowledgeSqlClientProvider();
    const repositoryProvider = createKnowledgeRepositoryProvider();
    const sessionRepositoryProvider = createKnowledgeSessionRepositoryProvider();
    const vectorStoreProvider = createKnowledgeVectorStoreProvider();

    expect(sqlClientProvider.provide).toBe(KNOWLEDGE_SQL_CLIENT);
    expect(sqlClientProvider.useFactory(memoryConfig)).toBeUndefined();
    expect(repositoryProvider.provide).toBe(KNOWLEDGE_REPOSITORY);
    expect(sessionRepositoryProvider.provide).toBe(KNOWLEDGE_SESSION_REPOSITORY);
    expect(vectorStoreProvider.provide).toBe(KNOWLEDGE_VECTOR_STORE);
    expect(repositoryProvider.useFactory(memoryConfig, undefined)).toBeInstanceOf(InMemoryKnowledgeRepository);
    expect(sessionRepositoryProvider.useFactory(memoryConfig, undefined)).toBeInstanceOf(
      InMemoryKnowledgeSessionRepository
    );
    awaitExpectNoopVectorStore(vectorStoreProvider.useFactory(memoryConfig));
  });

  it('creates postgres repositories with the injected singleton SQL client', () => {
    const repositoryProvider = createKnowledgeRepositoryProvider();
    const sessionRepositoryProvider = createKnowledgeSessionRepositoryProvider();
    const sqlClient: KnowledgeSqlClient = { query: vi.fn() };

    expect(repositoryProvider.useFactory(postgresConfig, sqlClient)).toBeInstanceOf(PostgresKnowledgeRepository);
    expect(sessionRepositoryProvider.useFactory(postgresConfig, sqlClient)).toBeInstanceOf(
      PostgresKnowledgeSessionRepository
    );
  });

  it('closes the SQL client through the lifecycle wrapper when present', async () => {
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const lifecycle = new KnowledgeSqlClientLifecycle({ query: vi.fn(), close });

    await lifecycle.onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('treats a missing SQL client as a lifecycle no-op', async () => {
    const lifecycle = new KnowledgeSqlClientLifecycle(undefined);

    await expect(lifecycle.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('registers the SQL client lifecycle provider with the provider set', () => {
    const lifecycleProvider = createKnowledgeSqlClientLifecycleProvider();
    const providers = createKnowledgeProviderProviders();

    expect(lifecycleProvider.inject).toEqual([KNOWLEDGE_SQL_CLIENT]);
    expect(providers.map(provider => ('provide' in provider ? provider.provide : provider))).toContain(
      KnowledgeSqlClientLifecycle
    );
  });

  it('compiles KnowledgeModule in memory mode and resolves in-memory repositories', async () => {
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousDatabaseUrl = process.env.DATABASE_URL;

    try {
      delete process.env.KNOWLEDGE_REPOSITORY;
      delete process.env.DATABASE_URL;

      const moduleRef = await Test.createTestingModule({
        imports: [KnowledgeModule]
      }).compile();

      expect(moduleRef.get(KNOWLEDGE_REPOSITORY)).toBeInstanceOf(InMemoryKnowledgeRepository);
      expect(moduleRef.get(KNOWLEDGE_SESSION_REPOSITORY)).toBeInstanceOf(InMemoryKnowledgeSessionRepository);
      await awaitExpectNoopVectorStore(moduleRef.get(KNOWLEDGE_VECTOR_STORE));

      await moduleRef.close();
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('compiles KnowledgeModule in postgres mode with an overridable SQL client singleton', async () => {
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const sqlClient: KnowledgeSqlClient = { query: vi.fn() };

    try {
      process.env.KNOWLEDGE_REPOSITORY = 'postgres';
      process.env.DATABASE_URL = 'postgres://localhost/knowledge';

      const moduleRef = await Test.createTestingModule({
        imports: [KnowledgeModule]
      })
        .overrideProvider(KNOWLEDGE_SQL_CLIENT)
        .useValue(sqlClient)
        .compile();

      expect(moduleRef.get(KNOWLEDGE_SQL_CLIENT)).toBe(sqlClient);
      expect(moduleRef.get(KNOWLEDGE_REPOSITORY)).toBeInstanceOf(PostgresKnowledgeRepository);
      expect(moduleRef.get(KNOWLEDGE_SESSION_REPOSITORY)).toBeInstanceOf(PostgresKnowledgeSessionRepository);

      await moduleRef.close();
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('resolves a Supabase pgvector store provider with fake fetch in production vector mode', async () => {
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousVectorStore = process.env.KNOWLEDGE_VECTOR_STORE;
    const previousSupabaseUrl = process.env.SUPABASE_URL;
    const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ upserted_count: 1 })
    }));

    try {
      vi.stubGlobal('fetch', fakeFetch);
      delete process.env.KNOWLEDGE_REPOSITORY;
      process.env.KNOWLEDGE_VECTOR_STORE = 'supabase-pgvector';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

      const moduleRef = await Test.createTestingModule({
        imports: [KnowledgeModule]
      })
        .overrideProvider(KNOWLEDGE_PROVIDER_CONFIG)
        .useValue({
          repository: { kind: 'memory' },
          vectorStore: {
            kind: 'supabase-pgvector',
            supabaseUrl: 'https://example.supabase.co',
            serviceRoleKey: 'service-role-key'
          }
        } satisfies KnowledgeProviderConfig)
        .compile();

      const vectorStore = moduleRef.get<KnowledgeVectorStore>(KNOWLEDGE_VECTOR_STORE);
      await expect(
        vectorStore.upsert({
          tenantId: 'tenant-1',
          knowledgeBaseId: 'kb-1',
          documentId: 'doc-1',
          chunks: [
            {
              id: 'chunk-1',
              tenantId: 'tenant-1',
              knowledgeBaseId: 'kb-1',
              documentId: 'doc-1',
              text: 'chunk',
              ordinal: 0,
              tokenCount: 1,
              embedding: createEmbedding(0.1),
              metadata: {}
            }
          ]
        })
      ).resolves.toEqual({ inserted: 1 });
      expect(fakeFetch).toHaveBeenCalledOnce();

      await moduleRef.close();
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('KNOWLEDGE_VECTOR_STORE', previousVectorStore);
      restoreEnvValue('SUPABASE_URL', previousSupabaseUrl);
      restoreEnvValue('SUPABASE_SERVICE_ROLE_KEY', previousServiceRoleKey);
      vi.unstubAllGlobals();
    }
  });

  it('closes the overridden SQL client when KnowledgeModule shuts down', async () => {
    const previousRepository = process.env.KNOWLEDGE_REPOSITORY;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const close = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const sqlClient: KnowledgeSqlClient = { query: vi.fn(), close };

    try {
      process.env.KNOWLEDGE_REPOSITORY = 'postgres';
      process.env.DATABASE_URL = 'postgres://localhost/knowledge';

      const moduleRef = await Test.createTestingModule({
        imports: [KnowledgeModule]
      })
        .overrideProvider(KNOWLEDGE_SQL_CLIENT)
        .useValue(sqlClient)
        .compile();

      await moduleRef.close();

      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      restoreEnvValue('KNOWLEDGE_REPOSITORY', previousRepository);
      restoreEnvValue('DATABASE_URL', previousDatabaseUrl);
    }
  });

  it('keeps KnowledgeModule as the backend module that exposes repository Symbol providers', () => {
    const providers = Reflect.getMetadata('providers', KnowledgeModule) as unknown[];
    const tokens = providers.map(provider => (isProviderObject(provider) ? provider.provide : provider));

    expect(tokens).toContain(KNOWLEDGE_REPOSITORY);
    expect(tokens).toContain(KNOWLEDGE_SESSION_REPOSITORY);
    expect(tokens).toContain(KNOWLEDGE_VECTOR_STORE);
  });
});

async function awaitExpectNoopVectorStore(vectorStore: KnowledgeVectorStore): Promise<void> {
  await expect(
    vectorStore.upsert({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      chunks: []
    })
  ).resolves.toEqual({ inserted: 0 });
  await expect(
    vectorStore.search({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1', embedding: [0.1], topK: 3 })
  ).resolves.toEqual({ matches: [] });
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function isProviderObject(provider: unknown): provider is { provide: unknown } {
  return typeof provider === 'object' && provider !== null && 'provide' in provider;
}

function createEmbedding(seed: number): number[] {
  return Array.from({ length: 1024 }, (_, index) => seed + index / 10000);
}
