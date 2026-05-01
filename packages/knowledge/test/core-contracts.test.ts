import { describe, expect, it } from 'vitest';

import { KnowledgeBaseSchema, KnowledgeValidationError, type EmbeddingProvider, type VectorStore } from '../src/core';

describe('knowledge SDK core contracts', () => {
  it('parses a knowledge base contract', () => {
    const parsed = KnowledgeBaseSchema.parse({
      id: 'kb_1',
      workspaceId: 'ws_1',
      name: '前端知识库',
      tags: ['frontend'],
      visibility: 'workspace',
      status: 'active',
      documentCount: 1,
      chunkCount: 3,
      readyDocumentCount: 1,
      failedDocumentCount: 0,
      createdBy: 'user_1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    });

    expect(parsed.name).toBe('前端知识库');
  });

  it('exposes provider interfaces without vendor types', async () => {
    const embeddingProvider: EmbeddingProvider = {
      embed: async input => ({ embedding: input.text.split('').map(() => 0.1), model: 'test' })
    };
    const vectorStore: VectorStore = {
      upsert: async input => ({ upsertedCount: input.records.length }),
      search: async () => ({ hits: [] }),
      delete: async () => ({ deletedCount: 0 })
    };

    await expect(embeddingProvider.embed({ text: 'hello' })).resolves.toMatchObject({ model: 'test' });
    await expect(vectorStore.search({ embedding: [0.1], topK: 5 })).resolves.toEqual({ hits: [] });
  });

  it('uses SDK error base classes', () => {
    const error = new KnowledgeValidationError('Invalid input', { code: 'knowledge.validation_failed' });

    expect(error.code).toBe('knowledge.validation_failed');
    expect(error.category).toBe('validation');
  });
});
