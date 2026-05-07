import { describe, expect, it, vi } from 'vitest';

import {
  createKnowledgeRepositoryProvider,
  KnowledgeRepositoryConfigError
} from '../../src/domains/knowledge/runtime/knowledge-repository.provider';
import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import {
  PostgresKnowledgeRepository,
  type PostgresKnowledgeClient
} from '../../src/domains/knowledge/repositories/knowledge-postgres.repository';

describe('createKnowledgeRepositoryProvider', () => {
  it('uses the memory repository when the backend is not configured', async () => {
    const provider = createKnowledgeRepositoryProvider({ backend: undefined });

    await expect(provider.useFactory()).resolves.toBeInstanceOf(KnowledgeMemoryRepository);
  });

  it('uses the memory repository when explicitly configured', async () => {
    const provider = createKnowledgeRepositoryProvider({ backend: 'memory', databaseUrl: 'postgres://ignored' });

    await expect(provider.useFactory()).resolves.toBeInstanceOf(KnowledgeMemoryRepository);
  });

  it('rejects postgres configuration without a database url', async () => {
    const provider = createKnowledgeRepositoryProvider({ backend: 'postgres' });

    await expect(provider.useFactory()).rejects.toBeInstanceOf(KnowledgeRepositoryConfigError);
  });

  it('initializes schema and returns the postgres repository when configured', async () => {
    const client: PostgresKnowledgeClient = {
      query: vi.fn(async () => ({ rows: [] }))
    };
    const provider = createKnowledgeRepositoryProvider({
      backend: 'postgres',
      databaseUrl: 'postgres://knowledge',
      createClient: () => client
    });

    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(PostgresKnowledgeRepository);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('create table if not exists knowledge_bases'));
  });
});
