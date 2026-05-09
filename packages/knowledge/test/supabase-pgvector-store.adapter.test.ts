import { describe, expect, it } from 'vitest';

import type { KnowledgeSdkVectorStore } from '@agent/knowledge';
import { AdapterError } from '../src/adapters/shared/errors/adapter-error';
import { SupabasePgVectorStoreAdapter } from '../src/adapters/supabase/supabase-pgvector-store.adapter';

describe('SupabasePgVectorStoreAdapter', () => {
  it('implements the Knowledge SDK VectorStore contract', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          if (name === 'match_knowledge_chunks') {
            return {
              data: [
                {
                  chunk_id: 'chunk-1',
                  document_id: 'doc-1',
                  content: 'Knowledge SDK chunk',
                  score: 0.87,
                  metadata: { knowledgeBaseId: 'kb-1', documentId: 'doc-1' }
                }
              ],
              error: null
            };
          }
          if (name === 'delete_knowledge_document_chunks') {
            return { data: { deleted_count: 1 }, error: null };
          }
          return { data: { upserted_count: 1 }, error: null };
        }
      },
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-default',
      documentId: 'doc-default'
    });
    const sdkVectorStore: KnowledgeSdkVectorStore = adapter;

    const upsertResult = await sdkVectorStore.upsert({
      records: [
        {
          id: 'chunk-1',
          embedding: [0.1, 0.2],
          content: 'Knowledge SDK chunk',
          metadata: { knowledgeBaseId: 'kb-1', documentId: 'doc-1', tags: ['sdk'] }
        }
      ]
    });
    const searchResult = await sdkVectorStore.search({
      embedding: [0.1, 0.2],
      topK: 3,
      filters: { knowledgeBaseId: 'kb-1', documentId: 'doc-1', query: 'sdk', tags: ['sdk'] }
    });
    const deleteResult = await sdkVectorStore.delete({
      filter: { knowledgeBaseId: 'kb-1', documentId: 'doc-1' }
    });

    expect(upsertResult).toEqual({ upsertedCount: 1 });
    expect(searchResult.hits).toEqual([
      {
        id: 'chunk-1',
        score: 0.87,
        content: 'Knowledge SDK chunk',
        metadata: { knowledgeBaseId: 'kb-1', documentId: 'doc-1' }
      }
    ]);
    expect(deleteResult).toEqual({ deletedCount: 1 });
    expect(calls).toEqual([
      {
        name: 'upsert_knowledge_chunks',
        args: {
          tenant_id: 'tenant-1',
          knowledge_base_id: 'kb-1',
          document_id: 'doc-1',
          records: [
            {
              chunk_id: 'chunk-1',
              text: 'Knowledge SDK chunk',
              embedding: [0.1, 0.2],
              ordinal: null,
              token_count: null,
              metadata: { knowledgeBaseId: 'kb-1', documentId: 'doc-1', tags: ['sdk'] }
            }
          ]
        }
      },
      {
        name: 'match_knowledge_chunks',
        args: {
          tenant_id: 'tenant-1',
          knowledge_base_id: 'kb-1',
          query_text: 'sdk',
          embedding: [0.1, 0.2],
          top_k: 3,
          filters: { document_ids: ['doc-1'], tags: ['sdk'] }
        }
      },
      {
        name: 'delete_knowledge_document_chunks',
        args: {
          tenant_id: 'tenant-1',
          knowledge_base_id: 'kb-1',
          document_id: 'doc-1'
        }
      }
    ]);
  });

  it('maps vector search requests to the match_knowledge_chunks RPC', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return {
            data: [
              {
                chunk_id: 'chunk-1',
                document_id: 'doc-1',
                content: '检索评测包含 Recall@K。',
                score: 0.91,
                metadata: { title: 'RAG知识框架.pptx' }
              }
            ],
            error: null
          };
        }
      }
    });

    const result = await adapter.search({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      query: '检索评测有哪些指标',
      embedding: [0.1, 0.2, 0.3],
      topK: 5,
      filters: { documentIds: ['doc-1'], tags: ['rag'], metadata: { phase: 'eval' } }
    });

    expect(calls[0]).toEqual({
      name: 'match_knowledge_chunks',
      args: {
        tenant_id: 'tenant-1',
        knowledge_base_id: 'kb-1',
        query_text: '检索评测有哪些指标',
        embedding: [0.1, 0.2, 0.3],
        top_k: 5,
        filters: { document_ids: ['doc-1'], tags: ['rag'], metadata: { phase: 'eval' } }
      }
    });
    expect(result.matches).toEqual([
      {
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        text: '检索评测包含 Recall@K。',
        score: 0.91,
        metadata: { title: 'RAG知识框架.pptx' }
      }
    ]);
  });

  it('uses null query_text when search query is omitted', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: [], error: null };
        }
      }
    });

    await adapter.search({
      knowledgeBaseId: 'kb-1',
      embedding: [0.1, 0.2],
      topK: 2
    });

    expect(calls[0]?.args.query_text).toBeNull();
  });

  it('rejects non-array search data', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: { matches: [] }, error: null })
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects malformed search rows', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({
          data: [
            {
              chunk_id: 'chunk-1',
              document_id: 'doc-1',
              content: '',
              score: Number.NaN,
              metadata: {}
            }
          ],
          error: null
        })
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects malformed search row metadata', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({
          data: [
            {
              chunk_id: 'chunk-1',
              document_id: 'doc-1',
              content: 'chunk',
              score: 0.5,
              metadata: ['not', 'a', 'record']
            }
          ],
          error: null
        })
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('maps upsert chunks to snake_case records for the upsert_knowledge_chunks RPC', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { upserted_count: 1 }, error: null };
        }
      }
    });

    const result = await adapter.upsert({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      chunks: [
        {
          id: 'chunk-1',
          text: 'Supabase pgvector chunk',
          embedding: [0.4, 0.5],
          ordinal: 2,
          tokenCount: 8,
          metadata: { tags: ['rag'] }
        }
      ]
    });

    expect(calls[0]).toEqual({
      name: 'upsert_knowledge_chunks',
      args: {
        tenant_id: 'tenant-1',
        knowledge_base_id: 'kb-1',
        document_id: 'doc-1',
        records: [
          {
            chunk_id: 'chunk-1',
            text: 'Supabase pgvector chunk',
            embedding: [0.4, 0.5],
            ordinal: 2,
            token_count: 8,
            metadata: { tags: ['rag'] }
          }
        ]
      }
    });
    expect(result).toEqual({ upsertedCount: 1 });
  });

  it('maps SDK upsert record ordinal and token count metadata to RPC records', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { upserted_count: 1 }, error: null };
        }
      }
    });

    await adapter.upsert({
      records: [
        {
          id: 'chunk-2',
          content: 'SDK vector chunk',
          embedding: [0.2, 0.3],
          metadata: {
            tenantId: 'tenant-1',
            knowledgeBaseId: 'kb-1',
            documentId: 'doc-1',
            ordinal: 2,
            tokenCount: 5
          }
        }
      ]
    });

    expect(calls[0]?.args.records).toEqual([
      {
        chunk_id: 'chunk-2',
        text: 'SDK vector chunk',
        embedding: [0.2, 0.3],
        ordinal: 2,
        token_count: 5,
        metadata: {
          tenantId: 'tenant-1',
          knowledgeBaseId: 'kb-1',
          documentId: 'doc-1',
          ordinal: 2,
          tokenCount: 5
        }
      }
    ]);
  });

  it('uses null optional chunk fields when mapping upsert records', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { upserted_count: 1 }, error: null };
        }
      }
    });

    await adapter.upsert({
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      chunks: [
        {
          id: 'chunk-1',
          text: 'chunk',
          embedding: [0.1],
          metadata: {}
        }
      ]
    });

    expect(calls[0]?.args.records).toEqual([
      {
        chunk_id: 'chunk-1',
        text: 'chunk',
        embedding: [0.1],
        ordinal: null,
        token_count: null,
        metadata: {}
      }
    ]);
  });

  it('returns zero for empty upsert chunks without calling RPC', async () => {
    let calls = 0;
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => {
          calls += 1;
          return { data: { upserted_count: 1 }, error: null };
        }
      }
    });

    const result = await adapter.upsert({
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      chunks: []
    });

    expect(result).toEqual({ upsertedCount: 0 });
    expect(calls).toBe(0);
  });

  it('rejects null or malformed upsert data', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: null, error: null })
      }
    });

    await expect(
      adapter.upsert({
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1',
        chunks: [{ id: 'chunk-1', text: 'chunk', embedding: [0.1] }]
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects upsert embedding dimension mismatch', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: { upserted_count: 2 }, error: null })
      }
    });

    await expect(
      adapter.upsert({
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1',
        chunks: [
          { id: 'chunk-1', text: 'one', embedding: [0.1, 0.2] },
          { id: 'chunk-2', text: 'two', embedding: [0.3] }
        ]
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects invalid search embedding and topK', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: [], error: null })
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [],
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: 'not-an-array' as never,
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 0
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('rejects negative or fractional RPC counts', async () => {
    const negativeUpsertAdapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: { upserted_count: -1 }, error: null })
      }
    });
    const fractionalDeleteAdapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: { deleted_count: 1.5 }, error: null })
      }
    });

    await expect(
      negativeUpsertAdapter.upsert({
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1',
        chunks: [{ id: 'chunk-1', text: 'chunk', embedding: [0.1] }]
      })
    ).rejects.toBeInstanceOf(AdapterError);
    await expect(
      fractionalDeleteAdapter.deleteByDocumentId({
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1'
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('maps delete requests to the delete_knowledge_document_chunks RPC', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { deleted_count: 3 }, error: null };
        }
      }
    });

    const result = await adapter.deleteByDocumentId({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1'
    });

    expect(calls[0]).toEqual({
      name: 'delete_knowledge_document_chunks',
      args: {
        tenant_id: 'tenant-1',
        knowledge_base_id: 'kb-1',
        document_id: 'doc-1'
      }
    });
    expect(result).toEqual({ deletedCount: 3 });
  });

  it('rejects null or malformed delete data', async () => {
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: { deleted_count: '3' }, error: null })
      }
    });

    await expect(
      adapter.deleteByDocumentId({
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1'
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('wraps RPC errors in AdapterError', async () => {
    const rawError = { message: 'permission denied', code: '42501' };
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => ({ data: null, error: rawError })
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toMatchObject({
      name: 'AdapterError',
      adapterName: 'SupabasePgVectorStoreAdapter',
      cause: rawError
    });
    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('wraps thrown RPC errors in AdapterError', async () => {
    const rawError = new Error('network failed');
    const adapter = new SupabasePgVectorStoreAdapter({
      client: {
        rpc: async () => {
          throw rawError;
        }
      }
    });

    await expect(
      adapter.search({
        knowledgeBaseId: 'kb-1',
        embedding: [0.1],
        topK: 1
      })
    ).rejects.toMatchObject({
      name: 'AdapterError',
      adapterName: 'SupabasePgVectorStoreAdapter',
      cause: rawError
    });
  });
});
