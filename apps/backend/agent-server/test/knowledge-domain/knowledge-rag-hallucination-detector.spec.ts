import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeRagHallucinationDetector } from '../../src/domains/knowledge/rag/knowledge-rag-hallucination-detector';

describe('KnowledgeRagHallucinationDetector', () => {
  it('parses hallucination risk from the LLM boundary and clamps the score', async () => {
    const generate = vi.fn(async () => ({
      text: JSON.stringify({
        hallucinationScore: 1.4,
        flagged: true,
        reasoning: 'unsupported timeline'
      })
    }));
    const detector = createKnowledgeRagHallucinationDetector({ generate, modelId: 'judge-model' });

    await expect(
      detector.detect({
        answer: 'The rollout finished yesterday.',
        citations: [
          {
            sourceId: 'doc_1',
            chunkId: 'chunk_1',
            title: 'Release notes',
            uri: '',
            quote: 'The rollout is scheduled for next week.',
            sourceType: 'user-upload',
            trustClass: 'internal'
          }
        ]
      })
    ).resolves.toEqual({
      hallucinationScore: 1,
      flagged: true,
      reasoning: 'unsupported timeline'
    });
  });

  it('returns neutral risk when there are no citations', async () => {
    const generate = vi.fn(async () => ({ text: '{}' }));
    const detector = createKnowledgeRagHallucinationDetector({ generate, modelId: 'judge-model' });

    await expect(detector.detect({ answer: 'No sources.', citations: [] })).resolves.toEqual({
      hallucinationScore: 0,
      flagged: false
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
