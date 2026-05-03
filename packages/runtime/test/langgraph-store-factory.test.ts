import { describe, expect, it, vi } from 'vitest';

const postgresStoreMocks = vi.hoisted(() => {
  const setupMock = vi.fn(async () => undefined);
  const stopMock = vi.fn(async () => undefined);
  const fromConnStringMock = vi.fn(() => ({
    setup: setupMock,
    stop: stopMock
  }));
  return { setupMock, stopMock, fromConnStringMock };
});

vi.mock('@langchain/langgraph-checkpoint-postgres/store', () => ({
  PostgresStore: {
    fromConnString: postgresStoreMocks.fromConnStringMock
  }
}));

import { createLangGraphStore } from '../src/runtime/langgraph-store';

const embeddingProvider = {
  embedQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
  embedDocuments: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]))
};

describe('@agent/runtime LangGraph long-term store factory', () => {
  it('creates an in-memory store with semantic search index by default', async () => {
    const handle = createLangGraphStore({
      config: {
        provider: 'memory',
        semanticSearch: {
          enabled: true,
          fields: ['$.text', '$.summary', '$.content']
        }
      },
      embeddingProvider,
      embeddingDimensions: 3
    });

    expect(handle.provider).toBe('memory');
    expect(handle.store).toBeDefined();

    await handle.store.put(['users', 'user-1', 'memories'], 'pizza', { text: 'User loves pizza' });
    const results = await handle.store.search(['users', 'user-1', 'memories'], {
      query: 'hungry',
      limit: 1
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.key).toBe('pizza');
    expect(embeddingProvider.embedQuery).toHaveBeenCalledWith('hungry');
  });

  it('creates a PostgresStore with semantic search index and lifecycle hooks', async () => {
    const handle = createLangGraphStore({
      config: {
        provider: 'postgres',
        postgres: {
          connectionString: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
          schema: 'agent_memory',
          setupOnInitialize: true
        },
        semanticSearch: {
          enabled: true,
          fields: ['$.data'],
          distanceMetric: 'inner_product'
        }
      },
      embeddingProvider,
      embeddingDimensions: 3
    });

    expect(handle.provider).toBe('postgres');
    expect(postgresStoreMocks.fromConnStringMock).toHaveBeenCalledWith(
      'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
      {
        schema: 'agent_memory',
        index: {
          dims: 3,
          embed: embeddingProvider,
          fields: ['$.data'],
          distanceMetric: 'inner_product'
        }
      }
    );

    await handle.initialize();
    await handle.close();

    expect(postgresStoreMocks.setupMock).toHaveBeenCalledTimes(1);
    expect(postgresStoreMocks.stopMock).toHaveBeenCalledTimes(1);
  });

  it('fails fast when Postgres store is enabled without a connection string', () => {
    expect(() =>
      createLangGraphStore({
        config: {
          provider: 'postgres',
          postgres: {
            schema: 'public',
            setupOnInitialize: true
          },
          semanticSearch: {
            enabled: true,
            fields: ['$.text']
          }
        },
        embeddingProvider,
        embeddingDimensions: 3
      })
    ).toThrow('LANGGRAPH_STORE_POSTGRES_URI is required when LANGGRAPH_STORE=postgres.');
  });
});
