import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeRagRerankProvider } from '../../src/domains/knowledge/rag/knowledge-rag-rerank.provider';

function createHit(chunkId: string, content: string) {
  return {
    chunkId,
    documentId: `doc_${chunkId}`,
    sourceId: `doc_${chunkId}`,
    knowledgeBaseId: 'kb_1',
    title: 'Test',
    uri: '',
    sourceType: 'user-upload' as const,
    trustClass: 'internal' as const,
    content,
    score: 0.5,
    metadata: {},
    citation: {
      sourceId: `doc_${chunkId}`,
      chunkId,
      title: 'Test',
      uri: '',
      quote: content,
      sourceType: 'user-upload' as const,
      trustClass: 'internal' as const
    }
  };
}

describe('KnowledgeRagRerankProvider', () => {
  it('reranks hits by parsing JSON scores from the LLM boundary', async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify([
        { chunkId: 'chunk_a', alignmentScore: 0.95 },
        { chunkId: 'chunk_b', alignmentScore: 0.3 }
      ])
    }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    const scores = await provider.rerank({
      query: 'rotation policy',
      hits: [createHit('chunk_a', 'Rotate keys every 90 days.'), createHit('chunk_b', 'Backup retention is 30 days.')]
    });

    expect(generate).toHaveBeenCalledOnce();
    expect(scores).toEqual([
      { chunkId: 'chunk_a', alignmentScore: 0.95 },
      { chunkId: 'chunk_b', alignmentScore: 0.3 }
    ]);
  });

  it('returns neutral scores when reranking fails', async () => {
    const generate = vi.fn(async () => ({ text: 'not json' }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    await expect(provider.rerank({ query: 'test', hits: [createHit('chunk_1', 'content')] })).resolves.toEqual([
      { chunkId: 'chunk_1', alignmentScore: 0.5 }
    ]);
  });
});
