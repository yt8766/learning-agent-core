import { describe, expect, it, vi } from 'vitest';

import { KnowledgeMemoryRepository } from '../../src/domains/knowledge/repositories/knowledge-memory.repository';
import { KnowledgeServerSearchServiceAdapter } from '../../src/domains/knowledge/rag/knowledge-server-search-service.adapter';
import type { KnowledgeSdkRuntimeProviderValue } from '../../src/domains/knowledge/runtime/knowledge-sdk-runtime.provider';

describe('KnowledgeServerSearchServiceAdapter', () => {
  it('uses SDK embeddings and vector search before keyword fallback', async () => {
    const repository = new KnowledgeMemoryRepository();
    const runtime = enabledRuntime({
      embedText: vi.fn(async () => ({ embedding: [0.1, 0.2] })),
      search: vi.fn(async () => ({ hits: [{ id: 'chunk_vector', score: 0.91 }] }))
    });
    await seedDocument(repository, {
      baseId: 'kb_vector',
      documentId: 'doc_vector',
      chunkId: 'chunk_vector',
      content: '完全不同的中文内容，不包含英文 planner route token。'
    });

    const result = await new KnowledgeServerSearchServiceAdapter(repository, runtime).search({
      query: 'planner route token',
      filters: { knowledgeBaseIds: ['kb_vector'] },
      limit: 5
    });

    expect(runtime.runtime.embeddingProvider.embedText).toHaveBeenCalledWith({ text: 'planner route token' });
    expect(runtime.runtime.vectorStore.search).toHaveBeenCalledWith({
      embedding: [0.1, 0.2],
      topK: 5,
      filters: {
        knowledgeBaseId: 'kb_vector',
        tenantId: 'default',
        query: 'planner route token'
      }
    });
    expect(result.hits).toEqual([
      expect.objectContaining({
        chunkId: 'chunk_vector',
        documentId: 'doc_vector',
        knowledgeBaseId: 'kb_vector',
        score: 0.91
      })
    ]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'vector-only',
      enabledRetrievers: ['vector'],
      failedRetrievers: [],
      candidateCount: 1,
      preHitCount: 1,
      finalHitCount: 1
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

    const result = await new KnowledgeServerSearchServiceAdapter(repository, runtime).search({
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
      enabledRetrievers: ['keyword'],
      retrievers: ['vector', 'keyword'],
      failedRetrievers: [],
      candidateCount: 1,
      preHitCount: 0,
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

    const result = await new KnowledgeServerSearchServiceAdapter(repository, runtime).search({
      query: 'rotation policy',
      filters: { knowledgeBaseIds: ['kb_embedding_fallback'] },
      limit: 5
    });

    expect(result.hits).toEqual([expect.objectContaining({ chunkId: 'chunk_embedding_fallback' })]);
    expect(result.diagnostics).toMatchObject({
      retrievalMode: 'keyword-only',
      enabledRetrievers: ['keyword'],
      retrievers: ['vector', 'keyword'],
      failedRetrievers: ['vector'],
      finalHitCount: 1
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
      embeddingStatus: 'succeeded',
      vectorIndexStatus: 'succeeded',
      keywordIndexStatus: 'succeeded',
      createdAt: '2026-05-03T08:00:00.000Z',
      updatedAt: '2026-05-03T08:00:00.000Z'
    }
  ]);
}
