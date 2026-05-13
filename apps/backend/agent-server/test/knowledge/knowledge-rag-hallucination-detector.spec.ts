import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeRagHallucinationDetector } from '../../src/domains/knowledge/rag/knowledge-rag-hallucination-detector';

describe('createKnowledgeRagHallucinationDetector', () => {
  function makeDetector(generateFn?: (input: unknown) => Promise<{ text: string }>) {
    return createKnowledgeRagHallucinationDetector({
      generate: generateFn ?? (async () => ({ text: '{"hallucinationScore":0.1,"flagged":false,"reasoning":"ok"}' })),
      modelId: 'test-model'
    });
  }

  it('returns score 0 when no citations', async () => {
    const detector = makeDetector();
    const result = await detector.detect({ answer: 'some answer', citations: [] });
    expect(result).toEqual({ hallucinationScore: 0, flagged: false });
  });

  it('parses valid JSON response', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":0.3,"flagged":false,"reasoning":"mostly grounded"}'
    }));
    const result = await detector.detect({
      answer: 'test answer',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'Title', quote: 'Quote' }]
    });
    expect(result.hallucinationScore).toBe(0.3);
    expect(result.flagged).toBe(false);
    expect(result.reasoning).toBe('mostly grounded');
  });

  it('parses JSON wrapped in code fences', async () => {
    const detector = makeDetector(async () => ({
      text: '```json\n{"hallucinationScore":0.8,"flagged":true,"reasoning":"hallucinated"}\n```'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(0.8);
    expect(result.flagged).toBe(true);
  });

  it('parses JSON embedded in prose', async () => {
    const detector = makeDetector(async () => ({
      text: 'Here is my assessment: {"hallucinationScore":0.5,"flagged":false} done.'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(0.5);
  });

  it('handles code fence without json label', async () => {
    const detector = makeDetector(async () => ({
      text: '```\n{"hallucinationScore":0.2,"flagged":false}\n```'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(0.2);
  });

  it('clamps score to [0, 1]', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":1.5,"flagged":false}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(1);
  });

  it('clamps negative score to 0', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":-0.5,"flagged":false}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(0);
  });

  it('defaults flagged to true when score > 0.5 and flagged not boolean', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":0.7}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.flagged).toBe(true);
  });

  it('defaults flagged to false when score <= 0.5 and flagged not boolean', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":0.3}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.flagged).toBe(false);
  });

  it('defaults score to 0 when not a number', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":"high","flagged":true}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.hallucinationScore).toBe(0);
  });

  it('defaults reasoning to undefined when not a string', async () => {
    const detector = makeDetector(async () => ({
      text: '{"hallucinationScore":0.1,"flagged":false,"reasoning":42}'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result.reasoning).toBeUndefined();
  });

  it('returns neutral result on generate error', async () => {
    const detector = makeDetector(async () => {
      throw new Error('LLM unavailable');
    });
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result).toEqual({ hallucinationScore: 0, flagged: false });
  });

  it('throws when response has no JSON at all', async () => {
    const detector = makeDetector(async () => ({
      text: 'no json here at all'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    // catch block returns neutral
    expect(result).toEqual({ hallucinationScore: 0, flagged: false });
  });

  it('throws when parsed value is not an object', async () => {
    const detector = makeDetector(async () => ({
      text: '"just a string"'
    }));
    const result = await detector.detect({
      answer: 'test',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'T', quote: 'Q' }]
    });
    expect(result).toEqual({ hallucinationScore: 0, flagged: false });
  });

  it('passes model and messages to generate', async () => {
    const generateFn = vi.fn(async () => ({
      text: '{"hallucinationScore":0,"flagged":false}'
    }));
    const detector = createKnowledgeRagHallucinationDetector({
      generate: generateFn,
      modelId: 'my-model'
    });
    await detector.detect({
      answer: 'the answer',
      citations: [{ sourceId: 's1', chunkId: 'c1', title: 'Title', quote: 'Quote text' }]
    });
    expect(generateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'my-model',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ])
      })
    );
  });
});
