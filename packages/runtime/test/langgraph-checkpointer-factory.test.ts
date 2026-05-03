import { describe, expect, it, vi } from 'vitest';

const postgresMocks = vi.hoisted(() => {
  const setupMock = vi.fn(async () => undefined);
  const endMock = vi.fn(async () => undefined);
  const fromConnStringMock = vi.fn(() => ({
    setup: setupMock,
    end: endMock
  }));
  return { setupMock, endMock, fromConnStringMock };
});

vi.mock('@langchain/langgraph-checkpoint-postgres', () => ({
  PostgresSaver: {
    fromConnString: postgresMocks.fromConnStringMock
  }
}));

import { createLangGraphCheckpointer } from '../src/runtime/langgraph-checkpointer';

describe('@agent/runtime LangGraph checkpointer factory', () => {
  it('creates an in-memory checkpointer by default without setup work', async () => {
    const handle = createLangGraphCheckpointer({
      provider: 'memory',
      postgres: {
        schema: 'public',
        setupOnInitialize: true
      }
    });

    expect(handle.provider).toBe('memory');
    expect(handle.checkpointer).toBeDefined();

    await handle.initialize();
    await handle.close();

    expect(postgresMocks.fromConnStringMock).not.toHaveBeenCalled();
    expect(postgresMocks.setupMock).not.toHaveBeenCalled();
    expect(postgresMocks.endMock).not.toHaveBeenCalled();
  });

  it('creates a PostgresSaver and runs setup during initialize', async () => {
    const handle = createLangGraphCheckpointer({
      provider: 'postgres',
      postgres: {
        connectionString: 'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
        schema: 'agent_runtime',
        setupOnInitialize: true
      }
    });

    expect(handle.provider).toBe('postgres');
    expect(postgresMocks.fromConnStringMock).toHaveBeenCalledWith(
      'postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable',
      { schema: 'agent_runtime' }
    );

    await handle.initialize();
    await handle.close();

    expect(postgresMocks.setupMock).toHaveBeenCalledTimes(1);
    expect(postgresMocks.endMock).toHaveBeenCalledTimes(1);
  });

  it('fails fast when Postgres is enabled without a connection string', () => {
    expect(() =>
      createLangGraphCheckpointer({
        provider: 'postgres',
        postgres: {
          schema: 'public',
          setupOnInitialize: true
        }
      })
    ).toThrow('LANGGRAPH_POSTGRES_URI is required when LANGGRAPH_CHECKPOINTER=postgres.');
  });
});
