import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeRagRerankProvider } from '../../src/knowledge/rag/knowledge-rag-rerank.provider';

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
  it('reranks hits by calling the LLM and parsing JSON scores', async () => {
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
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'rerank-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('chunk_a')
          })
        ])
      })
    );
    expect(scores).toEqual([
      { chunkId: 'chunk_a', alignmentScore: 0.95 },
      { chunkId: 'chunk_b', alignmentScore: 0.3 }
    ]);
  });

  it('returns neutral scores when the LLM response is not valid JSON', async () => {
    const generate = vi.fn(async () => ({ text: 'invalid response' }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    const scores = await provider.rerank({
      query: 'test',
      hits: [createHit('chunk_1', 'content')]
    });

    expect(scores).toEqual([{ chunkId: 'chunk_1', alignmentScore: 0.5 }]);
  });

  it('only reranks the top 10 hits and returns neutral scores for the rest', async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify([{ chunkId: 'chunk_0', alignmentScore: 0.9 }])
    }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    const hits = Array.from({ length: 12 }, (_, index) => createHit(`chunk_${index}`, `content ${index}`));
    const scores = await provider.rerank({ query: 'test', hits });

    expect(generate).toHaveBeenCalledOnce();
    const firstCall = generate.mock.calls[0] as unknown as [{ messages: Array<{ content: string }> }];
    const userMessage = firstCall[0].messages[1]!.content;
    expect(userMessage).not.toContain('chunk_10');
    expect(userMessage).not.toContain('chunk_11');
    expect(scores).toHaveLength(12);
    expect(scores[0]).toEqual({ chunkId: 'chunk_0', alignmentScore: 0.9 });
    expect(scores[10]).toEqual({ chunkId: 'chunk_10', alignmentScore: 0.5 });
    expect(scores[11]).toEqual({ chunkId: 'chunk_11', alignmentScore: 0.5 });
  });

  it('returns empty scores when there are no hits', async () => {
    const generate = vi.fn(async () => ({ text: '[]' }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    const scores = await provider.rerank({ query: 'test', hits: [] });

    expect(generate).not.toHaveBeenCalled();
    expect(scores).toEqual([]);
  });

  it('clips scores to [0, 1]', async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify([
        { chunkId: 'chunk_a', alignmentScore: 1.5 },
        { chunkId: 'chunk_b', alignmentScore: -0.2 }
      ])
    }));
    const provider = createKnowledgeRagRerankProvider({ generate, modelId: 'rerank-model' });

    const scores = await provider.rerank({
      query: 'test',
      hits: [createHit('chunk_a', 'a'), createHit('chunk_b', 'b')]
    });

    expect(scores).toEqual([
      { chunkId: 'chunk_a', alignmentScore: 1 },
      { chunkId: 'chunk_b', alignmentScore: 0 }
    ]);
  });
});
