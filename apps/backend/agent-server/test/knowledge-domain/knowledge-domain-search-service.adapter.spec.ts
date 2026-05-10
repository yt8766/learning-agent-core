import { describe, expect, it, vi } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeDomainSearchServiceAdapter } from '../../src/domains/knowledge/rag/knowledge-domain-search-service.adapter';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';

describe('KnowledgeDomainSearchServiceAdapter', () => {
  it('runs keyword and vector retrieval together before RRF fusion', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      embedText: vi.fn(async () => ({ embedding: [0.1, 0.2] })),
      search: vi.fn(async () => ({ hits: [{ id: 'chunk_vector', score: 0.91 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_hybrid',
      documentId: 'doc_vector',
      chunkId: 'chunk_vector',
      content: '这是一段只应该由向量检索映射回来的中文片段，和英文查询没有字面重合。'
    });
    await seedDocument(repository, {
      baseId: 'kb_hybrid',
      documentId: 'doc_keyword',
      chunkId: 'chunk_keyword',
      content: 'planner route token should still be recovered by keyword retrieval'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'planner route token',
      filters: { knowledgeBaseIds: ['kb_hybrid'] },
      limit: 5
    });

    expect(runtime.runtime.embeddingProvider.embedText).toHaveBeenCalledWith({ text: 'planner route token' });
    expect(runtime.runtime.vectorStore.search).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      topK: 5,
      filters: {
        knowledgeBaseId: 'kb_hybrid',
        tenantId: 'default',
        query: 'planner route token'
      }
    });
    expect(result.hits.map(hit => hit.chunkId)).toEqual(expect.arrayContaining(['chunk_vector', 'chunk_keyword']));
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'hybrid',
      fallbackApplied: false,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      candidateCount: 2,
      finalHitCount: 2
    });
  });

  it('falls back to Chinese substring matching when vector search returns no hits', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({ hits: [] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_cn',
      documentId: 'doc_cn',
      chunkId: 'chunk_cn',
      content: '高风险动作必须进入审批门，并记录完整审计证据。'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: '风险动作审批',
      filters: { knowledgeBaseIds: ['kb_cn'] },
      limit: 5
    });

    expect(result.hits).toEqual([
      expect.objectContaining({
        chunkId: 'chunk_cn',
        score: expect.any(Number)
      })
    ]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      candidateCount: 1,
      finalHitCount: 1
    });
  });

  it('falls back to keyword retrieval when query embedding fails', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      embedText: vi.fn(async () => {
        throw new Error('embedding unavailable');
      })
    });
    await seedDocument(repository, {
      baseId: 'kb_embedding_fallback',
      documentId: 'doc_embedding_fallback',
      chunkId: 'chunk_embedding_fallback',
      content: 'rotation policy comes from repository chunks'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'rotation policy',
      filters: { knowledgeBaseIds: ['kb_embedding_fallback'] },
      limit: 5
    });

    expect(result.hits).toEqual([expect.objectContaining({ chunkId: 'chunk_embedding_fallback' })]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: ['vector'],
      finalHitCount: 1
    });
  });

  it('marks fallback when vector hits cannot be mapped to repository chunks', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({ hits: [{ id: 'missing_vector_chunk', score: 0.91 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_unmapped',
      documentId: 'doc_unmapped',
      chunkId: 'chunk_unmapped',
      content: 'fallback policy comes from repository chunks'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'fallback policy',
      filters: { knowledgeBaseIds: ['kb_unmapped'] },
      limit: 5
    });

    expect(result.hits).toEqual([expect.objectContaining({ chunkId: 'chunk_unmapped' })]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      preHitCount: 1,
      finalHitCount: 1
    });
  });

  it('uses keyword-only retrieval when SDK runtime is disabled', async () => {
    const repository = new KnowledgeMemoryRepository();
    await seedDocument(repository, {
      baseId: 'kb_keyword_only',
      documentId: 'doc_keyword_only',
      chunkId: 'chunk_keyword_only',
      content: 'manual approval policy is searchable without vector runtime'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository).search({
      query: 'manual approval',
      filters: { knowledgeBaseIds: ['kb_keyword_only'] },
      limit: 5
    });

    expect(result.hits).toEqual([expect.objectContaining({ chunkId: 'chunk_keyword_only' })]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: false,
      enabledRetrievers: ['keyword'],
      retrievers: ['keyword'],
      failedRetrievers: [],
      finalHitCount: 1
    });
  });

  it('boosts chunks returned by both keyword and vector retrievers through RRF', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({
        hits: [
          { id: 'chunk_shared', score: 0.6 },
          { id: 'chunk_vector_only', score: 0.99 }
        ]
      }))
    });
    await seedDocument(repository, {
      baseId: 'kb_rrf',
      documentId: 'doc_shared',
      chunkId: 'chunk_shared',
      content: 'shared policy appears in keyword retrieval'
    });
    await seedDocument(repository, {
      baseId: 'kb_rrf',
      documentId: 'doc_vector_only',
      chunkId: 'chunk_vector_only',
      content: 'semantic-only content'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'shared policy',
      filters: { knowledgeBaseIds: ['kb_rrf'] },
      limit: 5
    });

    expect(result.hits[0]?.chunkId).toBe('chunk_shared');
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'hybrid',
      enabledRetrievers: ['keyword', 'vector'],
      failedRetrievers: [],
      fusionStrategy: 'rrf',
      finalHitCount: 2
    });
  });

  it('reports keyword-only when mapped vector hits are removed by request filters', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({ hits: [{ id: 'chunk_vector_filtered', score: 0.99 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_filtered_mode',
      documentId: 'doc_keyword_active',
      chunkId: 'chunk_keyword_active',
      content: 'approval policy active keyword match',
      metadata: {
        status: 'active',
        knowledgeBaseId: 'stale_kb',
        workspaceId: 'stale_workspace',
        filename: 'stale.md',
        ordinal: 99
      }
    });
    await seedDocument(repository, {
      baseId: 'kb_filtered_mode',
      documentId: 'doc_vector_filtered',
      chunkId: 'chunk_vector_filtered',
      content: 'semantic-only inactive vector result',
      metadata: { status: 'inactive' }
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'approval policy',
      filters: { knowledgeBaseIds: ['kb_filtered_mode'], statuses: ['active'] },
      limit: 5
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk_keyword_active']);
    expect(result.hits[0]?.metadata).toMatchObject({
      status: 'active',
      knowledgeBaseId: 'kb_filtered_mode',
      workspaceId: 'default',
      filename: 'doc_keyword_active.md',
      ordinal: 0
    });
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      enabledRetrievers: ['keyword', 'vector'],
      retrievers: ['keyword', 'vector'],
      failedRetrievers: []
    });
  });

  it('keeps keyword and vector retrieval scoped to their own index status', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      search: vi.fn(async () => ({ hits: [{ id: 'chunk_vector_failed', score: 0.99 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_index_status',
      documentId: 'doc_keyword_failed',
      chunkId: 'chunk_keyword_failed',
      content: 'approval keyword should not be searchable when keyword index failed',
      keywordIndexStatus: 'failed',
      vectorIndexStatus: 'succeeded'
    });
    await seedDocument(repository, {
      baseId: 'kb_index_status',
      documentId: 'doc_vector_failed',
      chunkId: 'chunk_vector_failed',
      content: 'approval keyword fallback should still work when vector index failed',
      keywordIndexStatus: 'succeeded',
      vectorIndexStatus: 'failed'
    });

    const result = await new KnowledgeDomainSearchServiceAdapter(repository, runtime).search({
      query: 'approval keyword',
      filters: { knowledgeBaseIds: ['kb_index_status'] },
      limit: 5
    });

    expect(result.hits.map(hit => hit.chunkId)).toEqual(['chunk_vector_failed']);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      fallbackApplied: true,
      failedRetrievers: []
    });
  });
});

function enabledRuntime(input: {
  embedText?: (input: { text: string }) => Promise<{ embedding: number[] }>;
  search?: (input: {
    embedding: number[];
    topK: number;
    filters?: Record<string, unknown>;
  }) => Promise<{ hits: Array<{ id: string; score: number }> }>;
}): Extract<KnowledgeSdkRuntimeProviderValue, { enabled: true }> {
  return {
    enabled: true,
    runtime: {
      chatProvider: {
        providerId: 'fake',
        defaultModel: 'fake-chat',
        generate: async () => ({ text: 'answer', model: 'fake-chat', providerId: 'fake' })
      },
      embeddingProvider: {
        providerId: 'fake',
        defaultModel: 'fake-embedding',
        embedText: input.embedText ?? (async () => ({ embedding: [1, 2] }))
      },
      vectorStore: {
        search: input.search ?? (async () => ({ hits: [] }))
      }
    }
  };
}

async function seedDocument(
  repository: KnowledgeMemoryRepository,
  input: {
    baseId: string;
    documentId: string;
    chunkId: string;
    content: string;
    metadata?: Record<string, unknown>;
    embeddingStatus?: 'pending' | 'succeeded' | 'failed' | 'skipped';
    vectorIndexStatus?: 'pending' | 'succeeded' | 'failed' | 'skipped';
    keywordIndexStatus?: 'pending' | 'succeeded' | 'failed' | 'skipped';
  }
) {
  await repository.createDocument({
    id: input.documentId,
    workspaceId: 'default',
    knowledgeBaseId: input.baseId,
    uploadId: `upload_${input.documentId}`,
    objectKey: `knowledge/${input.baseId}/${input.documentId}.md`,
    filename: `${input.documentId}.md`,
    title: input.documentId,
    sourceType: 'user-upload',
    status: 'ready',
    version: 'v1',
    chunkCount: 1,
    embeddedChunkCount: 1,
    createdBy: 'user_1',
    metadata: {},
    createdAt: '2026-05-03T08:00:00.000Z',
    updatedAt: '2026-05-03T08:00:00.000Z'
  });
  await repository.saveChunks(input.documentId, [
    {
      id: input.chunkId,
      documentId: input.documentId,
      ordinal: 0,
      content: input.content,
      tokenCount: 10,
      embeddingStatus: input.embeddingStatus ?? 'succeeded',
      vectorIndexStatus: input.vectorIndexStatus ?? 'succeeded',
      keywordIndexStatus: input.keywordIndexStatus ?? 'succeeded',
      ...(input.metadata ? { metadata: input.metadata } : {}),
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:00:00.000Z'
    }
  ]);
}
