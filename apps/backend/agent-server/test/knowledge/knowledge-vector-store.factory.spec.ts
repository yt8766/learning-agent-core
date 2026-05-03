import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeVectorStore } from '../../src/knowledge/interfaces/knowledge-ingestion.types';
import {
  createKnowledgeVectorStore,
  createKnowledgeVectorStoreKind,
  createSupabaseRpcClient
} from '../../src/knowledge/knowledge-vector-store.factory';

describe('knowledge vector store factory', () => {
  it('keeps memory vector store for local mode', () => {
    expect(createKnowledgeVectorStoreKind({ kind: 'memory' })).toBe('memory');
  });

  it('selects supabase pgvector for production mode', () => {
    expect(
      createKnowledgeVectorStoreKind({
        kind: 'supabase-pgvector',
        supabaseUrl: 'https://example.supabase.co',
        serviceRoleKey: 'service-role-key'
      })
    ).toBe('supabase-pgvector');
  });

  it('posts Supabase RPC calls with backend credentials and JSON body', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ upserted_count: 1 }), { status: 200 }));
    const client = createSupabaseRpcClient({
      supabaseUrl: 'https://example.supabase.co/',
      serviceRoleKey: 'service-role-key',
      fetcher
    });

    await expect(client.rpc('upsert_knowledge_chunks', { records: [{ id: 'chunk-1' }] })).resolves.toEqual({
      data: { upserted_count: 1 },
      error: null
    });

    expect(fetcher).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/upsert_knowledge_chunks', {
      method: 'POST',
      headers: {
        apikey: 'service-role-key',
        Authorization: 'Bearer service-role-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: [{ id: 'chunk-1' }] })
    });
  });

  it('returns Supabase RPC errors without throwing so the adapter can normalize them', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'invalid key' }), { status: 401 }));
    const client = createSupabaseRpcClient({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher
    });

    await expect(client.rpc('match_knowledge_chunks', { top_k: 5 })).resolves.toEqual({
      data: null,
      error: { status: 401, body: { message: 'invalid key' } }
    });
  });

  it('returns text bodies for non-JSON Supabase RPC errors without throwing', async () => {
    const fetcher = vi.fn(async () => new Response('edge function crashed', { status: 500 }));
    const client = createSupabaseRpcClient({
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher
    });

    await expect(client.rpc('match_knowledge_chunks', { top_k: 5 })).resolves.toEqual({
      data: null,
      error: { status: 500, body: 'edge function crashed' }
    });
  });

  it('fails clearly when no backend fetch implementation is available', () => {
    vi.stubGlobal('fetch', undefined);

    try {
      expect(() =>
        createSupabaseRpcClient({
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'service-role-key'
        })
      ).toThrow('Supabase RPC client requires a fetch implementation in the backend runtime.');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('maps adapter upsertedCount to the ingestion vector store inserted result', async () => {
    const vectorStore = createKnowledgeVectorStore({
      kind: 'supabase-pgvector',
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher: async () => new Response(JSON.stringify({ upserted_count: 2 }), { status: 200 })
    });

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
            text: 'chunk 1',
            ordinal: 0,
            tokenCount: 2,
            embedding: createEmbedding(0.1),
            metadata: { title: 'Doc' }
          },
          {
            id: 'chunk-2',
            tenantId: 'tenant-1',
            knowledgeBaseId: 'kb-1',
            documentId: 'doc-1',
            text: 'chunk 2',
            ordinal: 1,
            tokenCount: 2,
            embedding: createEmbedding(0.2),
            metadata: { title: 'Doc' }
          }
        ]
      })
    ).resolves.toEqual({ inserted: 2 });
  });

  it('rejects Supabase upsert chunks without 1024-dimension embeddings', async () => {
    const vectorStore = createKnowledgeVectorStore({
      kind: 'supabase-pgvector',
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher: async () => new Response(JSON.stringify({ upserted_count: 1 }), { status: 200 })
    });

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
            text: 'chunk 1',
            ordinal: 0,
            tokenCount: 2,
            embedding: [0.1, 0.2],
            metadata: { title: 'Doc' }
          }
        ]
      })
    ).rejects.toThrow('Supabase pgvector embeddings must contain 1024 dimensions');
  });

  it('maps adapter deletedCount to the ingestion vector store deleted result', async () => {
    const vectorStore = createKnowledgeVectorStore({
      kind: 'supabase-pgvector',
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher: async () => new Response(JSON.stringify({ deleted_count: 3 }), { status: 200 })
    });

    await expect(
      vectorStore.deleteByDocumentId({
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1'
      })
    ).resolves.toEqual({ deleted: 3 });
  });

  it('maps adapter search matches to the local vector store contract', async () => {
    const vectorStore = createKnowledgeVectorStore({
      kind: 'supabase-pgvector',
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher: async () =>
        new Response(
          JSON.stringify([
            {
              chunk_id: 'chunk-1',
              document_id: 'doc-1',
              text: 'matched text',
              score: 0.92,
              metadata: { title: 'Doc' }
            }
          ]),
          {
            status: 200
          }
        )
    });

    await expect(
      vectorStore.search({
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        embedding: createEmbedding(0.1),
        topK: 5,
        filters: { documentIds: ['doc-1'], metadata: { title: 'Doc' } }
      })
    ).resolves.toEqual({
      matches: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          text: 'matched text',
          score: 0.92,
          metadata: { title: 'Doc' }
        }
      ]
    });
  });

  it('rejects Supabase search without a 1024-dimension query embedding', async () => {
    const vectorStore = createKnowledgeVectorStore({
      kind: 'supabase-pgvector',
      supabaseUrl: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetcher: async () => new Response(JSON.stringify([]), { status: 200 })
    });

    await expect(
      vectorStore.search({
        tenantId: 'tenant-1',
        knowledgeBaseId: 'kb-1',
        embedding: [0.1, 0.2],
        topK: 5
      })
    ).rejects.toThrow('Supabase pgvector embeddings must contain 1024 dimensions');
  });

  it('keeps memory mode as a no-op vector store', async () => {
    const vectorStore = createKnowledgeVectorStore({ kind: 'memory' });

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
    await expect(
      vectorStore.deleteByDocumentId({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1', documentId: 'doc-1' })
    ).resolves.toEqual({ deleted: 0 });
  });

  it('uses the KnowledgeVectorStore boundary for indexing and search', async () => {
    const calls: string[] = [];
    const vectorStore: KnowledgeVectorStore = {
      upsert: async input => {
        calls.push(`upsert:${input.documentId}`);
        return { inserted: input.chunks.length };
      },
      search: async input => {
        calls.push(`search:${input.knowledgeBaseId}`);
        return { matches: [] };
      },
      deleteByDocumentId: async input => {
        calls.push(`delete:${input.documentId}`);
        return { deleted: 0 };
      }
    };

    await vectorStore.upsert({
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-1',
      documentId: 'doc-1',
      chunks: []
    });
    await vectorStore.search({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1', embedding: [0.1], topK: 5 });
    await vectorStore.deleteByDocumentId({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1', documentId: 'doc-1' });

    expect(calls).toEqual(['upsert:doc-1', 'search:kb-1', 'delete:doc-1']);
  });
});

function createEmbedding(seed: number): number[] {
  return Array.from({ length: 1024 }, (_, index) => seed + index / 10000);
}
