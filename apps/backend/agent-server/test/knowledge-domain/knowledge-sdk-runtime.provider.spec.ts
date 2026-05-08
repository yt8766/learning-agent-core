import { describe, expect, it, vi } from 'vitest';

import { KNOWLEDGE_SCHEMA_SQL } from '../../src/domains/knowledge/runtime/knowledge-schema.sql';
import {
  createKnowledgeSdkRuntimeProvider,
  createPostgresKnowledgeSdkRpcClient
} from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';

function completeEnv() {
  return {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
    KNOWLEDGE_CHAT_MODEL: 'gpt-4.1-mini',
    KNOWLEDGE_EMBEDDING_MODEL: 'text-embedding-3-small',
    KNOWLEDGE_LLM_API_KEY: 'test-key',
    KNOWLEDGE_LLM_BASE_URL: 'https://llm.local/v1',
    KNOWLEDGE_CHAT_MAX_TOKENS: '1200',
    KNOWLEDGE_EMBEDDING_DIMENSIONS: '1024'
  };
}

describe('createKnowledgeSdkRuntimeProvider', () => {
  it('returns disabled when SDK env is not configured', async () => {
    const provider = createKnowledgeSdkRuntimeProvider({
      env: {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge'
      }
    });

    await expect(provider.useFactory()).resolves.toMatchObject({
      enabled: false,
      reason: 'missing_env',
      missingEnv: ['KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_EMBEDDING_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
      runtime: null
    });
  });

  it('returns disabled instead of blocking startup when SDK env is partial', async () => {
    const provider = createKnowledgeSdkRuntimeProvider({
      env: {
        DATABASE_URL: 'postgres://user:pass@localhost:5432/knowledge',
        KNOWLEDGE_EMBEDDING_MODEL: 'text-embedding-3-small'
      }
    });

    await expect(provider.useFactory()).resolves.toMatchObject({
      enabled: false,
      reason: 'missing_env',
      missingEnv: ['KNOWLEDGE_CHAT_MODEL', 'KNOWLEDGE_LLM_API_KEY'],
      runtime: null
    });
  });

  it('initializes schema and creates the default SDK runtime when env is complete', async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const createRuntime = vi.fn(config => ({
      chatProvider: { providerId: config.chat.provider, defaultModel: config.chat.model },
      embeddingProvider: {
        providerId: config.embedding.provider,
        defaultModel: config.embedding.model,
        dimensions: config.embedding.dimensions
      },
      vectorStore: { client: config.vectorStore.client }
    }));
    const provider = createKnowledgeSdkRuntimeProvider({
      env: completeEnv(),
      createRuntime,
      createClient: () => ({
        query: async (sql, values) => {
          queries.push({ sql, values });
          return { rows: [] };
        }
      })
    });

    const result = await provider.useFactory();

    expect(result.enabled).toBe(true);
    expect(queries[0]?.sql).toBe(KNOWLEDGE_SCHEMA_SQL);
    expect(createRuntime).toHaveBeenCalledWith({
      chat: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        baseURL: 'https://llm.local/v1',
        maxTokens: 1200
      },
      embedding: {
        provider: 'openai-compatible',
        apiKey: 'test-key',
        model: 'text-embedding-3-small',
        baseURL: 'https://llm.local/v1',
        dimensions: 1024,
        batchSize: undefined
      },
      vectorStore: { client: expect.objectContaining({ rpc: expect.any(Function) }) }
    });
  });
});

describe('createPostgresKnowledgeSdkRpcClient', () => {
  it('maps SDK RPC calls to postgres function SQL and args', async () => {
    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const client = createPostgresKnowledgeSdkRpcClient({
      query: async (sql, values) => {
        queries.push({ sql, values });
        return { rows: sql.includes('match_knowledge_chunks') ? [{ chunk_id: 'chunk_1' }] : [{ ok: true }] };
      }
    });

    await expect(
      client.rpc('upsert_knowledge_chunks', {
        tenant_id: 'tenant_1',
        knowledge_base_id: 'kb_1',
        document_id: 'doc_1',
        records: [{ chunk_id: 'chunk_1', text: 'hello', embedding: [0.1], metadata: {} }]
      })
    ).resolves.toEqual({ data: { ok: true }, error: null });
    await expect(
      client.rpc('match_knowledge_chunks', {
        tenant_id: 'tenant_1',
        knowledge_base_id: 'kb_1',
        query_text: 'hello',
        embedding: [0.1],
        top_k: 5,
        filters: { document_ids: ['doc_1'] }
      })
    ).resolves.toEqual({ data: [{ chunk_id: 'chunk_1' }], error: null });

    expect(queries).toEqual([
      {
        sql: 'select * from upsert_knowledge_chunks($1, $2, $3::jsonb, $4)',
        values: [
          'kb_1',
          'doc_1',
          JSON.stringify([{ chunk_id: 'chunk_1', text: 'hello', embedding: [0.1], metadata: {} }]),
          'tenant_1'
        ]
      },
      {
        sql: 'select * from match_knowledge_chunks($1, $2::vector, $3, $4, $5::jsonb, $6)',
        values: ['kb_1', '[0.1]', 5, 'hello', JSON.stringify({ document_ids: ['doc_1'] }), 'tenant_1']
      }
    ]);
  });
});
