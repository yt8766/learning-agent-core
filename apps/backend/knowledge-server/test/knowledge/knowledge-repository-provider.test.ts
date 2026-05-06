import { describe, expect, it } from 'vitest';

import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { PostgresKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-postgres.repository';
import { createKnowledgeRepositoryProvider } from '../../src/knowledge/runtime/knowledge-repository.provider';

describe('createKnowledgeRepositoryProvider', () => {
  it('uses memory when DATABASE_URL is absent', async () => {
    const provider = createKnowledgeRepositoryProvider({ databaseUrl: undefined });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(InMemoryKnowledgeRepository);
  });

  it('uses postgres when DATABASE_URL is configured', async () => {
    const provider = createKnowledgeRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/knowledge',
      createClient: () => ({ query: async () => ({ rows: [] }) })
    });
    const repository = await provider.useFactory();

    expect(repository).toBeInstanceOf(PostgresKnowledgeRepository);
  });

  it('applies the knowledge schema before exposing a postgres repository', async () => {
    const queries: string[] = [];
    const provider = createKnowledgeRepositoryProvider({
      databaseUrl: 'postgres://user:pass@localhost:5432/knowledge',
      createClient: () => ({
        query: async sql => {
          queries.push(sql);
          return { rows: [] };
        }
      })
    });

    await provider.useFactory();

    expect(queries[0]).toContain('create table if not exists knowledge_uploads');
  });
});
