import { describe, expect, it, vi } from 'vitest';

import type { RetrievalHit } from '../src/contracts';
import type { KnowledgeSearchService } from '../src/contracts/knowledge-facade';
import {
  streamKnowledgeRag,
  type KnowledgeAnswerProvider,
  type KnowledgeBaseRoutingCandidate,
  type KnowledgeRagPolicy,
  type KnowledgeRagStreamEvent,
  type KnowledgeStructuredPlannerProvider
} from '../src/rag';

const policy: KnowledgeRagPolicy = {
  maxSelectedKnowledgeBases: 2,
  minPlannerConfidence: 0.65,
  defaultSearchMode: 'hybrid',
  fallbackWhenPlannerFails: 'search-all-accessible',
  fallbackWhenLowConfidence: 'expand-to-top-n',
  maxQueryVariants: 3,
  retrievalTopK: 5,
  contextBudgetTokens: 3000,
  requireGroundedCitations: true,
  noAnswer: {
    minHitCount: 1,
    allowAnswerWithoutCitation: false,
    responseStyle: 'explicit-insufficient-evidence'
  }
};

const accessibleKnowledgeBases: KnowledgeBaseRoutingCandidate[] = [
  {
    id: 'kb_runtime',
    name: 'Runtime',
    description: 'Runtime and graph docs',
    tags: ['runtime'],
    documentCount: 4,
    recentDocumentTitles: []
  }
];

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  const chunkId = overrides.chunkId ?? 'chunk-1';
  const sourceId = overrides.sourceId ?? 'source-1';

  return {
    chunkId,
    documentId: overrides.documentId ?? 'doc-1',
    sourceId,
    knowledgeBaseId: overrides.knowledgeBaseId ?? 'kb_runtime',
    title: overrides.title ?? 'Runtime Guide',
    uri: overrides.uri ?? '/runtime.md',
    sourceType: overrides.sourceType ?? 'repo-docs',
    trustClass: overrides.trustClass ?? 'internal',
    content: overrides.content ?? 'Streaming RAG emits stable lifecycle events.',
    score: overrides.score ?? 0.91,
    citation: {
      sourceId,
      chunkId,
      title: overrides.title ?? 'Runtime Guide',
      uri: overrides.uri ?? '/runtime.md',
      sourceType: overrides.sourceType ?? 'repo-docs',
      trustClass: overrides.trustClass ?? 'internal'
    },
    ...overrides
  };
}

function makePlannerProvider(): KnowledgeStructuredPlannerProvider {
  return {
    plan: vi.fn(async () => ({
      rewrittenQuery: 'streaming rag lifecycle',
      queryVariants: ['streaming rag lifecycle'],
      selectedKnowledgeBaseIds: ['kb_runtime'],
      searchMode: 'hybrid' as const,
      selectionReason: 'Runtime docs are relevant.',
      confidence: 0.9
    }))
  };
}

function makeSearchService(hits: RetrievalHit[]): KnowledgeSearchService {
  return {
    search: vi.fn(async () => ({
      hits,
      total: hits.length
    }))
  };
}

function makeAnswerProvider(): KnowledgeAnswerProvider {
  return {
    generate: vi.fn(async input => ({
      text: 'Stable stream answer.',
      citations: input.citations
    }))
  };
}

function makeRecordingAnswerProvider(): KnowledgeAnswerProvider & {
  inputs: Parameters<KnowledgeAnswerProvider['generate']>[0][];
} {
  const inputs: Parameters<KnowledgeAnswerProvider['generate']>[0][] = [];

  return {
    inputs,
    generate: vi.fn(async input => {
      inputs.push(input);
      return {
        text: 'Stable stream answer.',
        citations: input.citations
      };
    })
  };
}

function makeStreamingAnswerProvider(): KnowledgeAnswerProvider & {
  generateInputs: Parameters<KnowledgeAnswerProvider['generate']>[0][];
  streamInputs: Parameters<NonNullable<KnowledgeAnswerProvider['stream']>>[0][];
} {
  const generateInputs: Parameters<KnowledgeAnswerProvider['generate']>[0][] = [];
  const streamInputs: Parameters<NonNullable<KnowledgeAnswerProvider['stream']>>[0][] = [];

  return {
    generateInputs,
    streamInputs,
    generate: vi.fn(async input => {
      generateInputs.push(input);
      throw new Error('generate must not be called after answer streaming');
    }),
    async *stream(input) {
      streamInputs.push(input);
      yield { textDelta: 'Streamed ' };
      yield { textDelta: 'answer.' };
    }
  };
}

async function collectEvents(events: AsyncIterable<KnowledgeRagStreamEvent>): Promise<KnowledgeRagStreamEvent[]> {
  const collected: KnowledgeRagStreamEvent[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
}

describe('streamKnowledgeRag', () => {
  it('emits stable lifecycle events and includes the completed result', async () => {
    const hit = makeHit();

    const events = await collectEvents(
      streamKnowledgeRag({
        query: 'How does stream RAG report lifecycle?',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService: makeSearchService([hit]),
        answerProvider: makeAnswerProvider(),
        idFactory: () => 'stream-run'
      })
    );

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'answer.completed',
      'rag.completed'
    ]);
    expect(events.every(event => event.runId === 'stream-run')).toBe(true);
    expect(events.find(event => event.type === 'answer.delta')).toBeUndefined();

    const completed = events.at(-1);
    expect(completed).toMatchObject({
      type: 'rag.completed',
      result: {
        runId: 'stream-run',
        answer: {
          text: 'Stable stream answer.',
          noAnswer: false,
          citations: [hit.citation]
        }
      }
    });
  });

  it('emits provider answer deltas before completion when stream is supported and citations are grounded', async () => {
    const hit = makeHit();
    const answerProvider = makeStreamingAnswerProvider();

    const events = await collectEvents(
      streamKnowledgeRag({
        query: 'How does stream RAG report lifecycle?',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService: makeSearchService([hit]),
        answerProvider,
        metadata: {
          tenantId: 'tenant-a'
        },
        idFactory: () => 'stream-delta-run'
      })
    );

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'answer.delta',
      'answer.delta',
      'answer.completed',
      'rag.completed'
    ]);
    expect(events.filter(event => event.type === 'answer.delta')).toEqual([
      { type: 'answer.delta', runId: 'stream-delta-run', delta: 'Streamed ' },
      { type: 'answer.delta', runId: 'stream-delta-run', delta: 'answer.' }
    ]);
    expect(events.find(event => event.type === 'answer.completed')).toMatchObject({
      answer: {
        text: 'Streamed answer.',
        noAnswer: false,
        citations: [hit.citation]
      }
    });
    expect(answerProvider.streamInputs).toHaveLength(1);
    expect(answerProvider.generateInputs).toHaveLength(0);
    expect(answerProvider.streamInputs[0]).toMatchObject({
      originalQuery: 'How does stream RAG report lifecycle?',
      rewrittenQuery: 'streaming rag lifecycle',
      contextBundle: expect.stringContaining('Streaming RAG emits stable lifecycle events.'),
      citations: [hit.citation],
      selectedKnowledgeBaseIds: ['kb_runtime'],
      metadata: expect.objectContaining({
        selectedKnowledgeBaseIds: ['kb_runtime'],
        retrievalTotal: 1,
        hitCount: 1,
        citationCount: 1,
        extra: { tenantId: 'tenant-a' }
      })
    });
  });

  it('uses grounded done result citations when provider stream completes with a result', async () => {
    const groundedHit = makeHit();
    const ungroundedHit = makeHit({ chunkId: 'chunk-2', sourceId: 'source-2' });
    const answerProvider: KnowledgeAnswerProvider & { generateCalls: number } = {
      generateCalls: 0,
      generate: vi.fn(async input => {
        answerProvider.generateCalls += 1;
        return { text: 'should not be called', citations: input.citations };
      }),
      async *stream(input) {
        yield { textDelta: 'Ignored ' };
        yield {
          result: {
            text: 'Done result answer.',
            citations: [input.citations[0]!, ungroundedHit.citation]
          }
        };
      }
    };

    const events = await collectEvents(
      streamKnowledgeRag({
        query: 'How does stream RAG report lifecycle?',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService: makeSearchService([groundedHit]),
        answerProvider,
        idFactory: () => 'stream-done-result-run'
      })
    );

    expect(answerProvider.generateCalls).toBe(0);
    expect(events.find(event => event.type === 'answer.completed')).toMatchObject({
      answer: {
        text: 'Done result answer.',
        noAnswer: false,
        citations: [groundedHit.citation]
      }
    });
  });

  it('emits rag.error and ends without throwing when retrieval fails', async () => {
    const searchService: KnowledgeSearchService = {
      search: vi.fn(async () => {
        throw new Error('search unavailable');
      })
    };

    const events = await collectEvents(
      streamKnowledgeRag({
        query: 'runtime docs',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService,
        answerProvider: makeAnswerProvider(),
        idFactory: () => 'stream-error-run'
      })
    );

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'rag.error'
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'rag.error',
      runId: 'stream-error-run',
      stage: 'retrieval',
      error: {
        code: 'retrieval_failed',
        message: 'search unavailable'
      }
    });
  });

  it('emits rag.error when fallback answer generation fails', async () => {
    const answerProvider: KnowledgeAnswerProvider = {
      generate: vi.fn(async () => {
        throw new Error('answer provider unavailable');
      })
    };

    const events = await collectEvents(
      streamKnowledgeRag({
        query: 'runtime docs',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService: makeSearchService([makeHit()]),
        answerProvider,
        idFactory: () => 'stream-answer-error-run'
      })
    );

    expect(events.map(event => event.type)).toEqual([
      'rag.started',
      'planner.started',
      'planner.completed',
      'retrieval.started',
      'retrieval.completed',
      'answer.started',
      'rag.error'
    ]);
    expect(events.at(-1)).toMatchObject({
      type: 'rag.error',
      runId: 'stream-answer-error-run',
      stage: 'answer',
      error: {
        code: 'answer_failed',
        message: 'answer provider unavailable'
      }
    });
  });

  it('passes high-level metadata to the answer provider', async () => {
    const answerProvider = makeRecordingAnswerProvider();

    await collectEvents(
      streamKnowledgeRag({
        query: 'How does stream RAG report lifecycle?',
        accessibleKnowledgeBases,
        policy,
        plannerProvider: makePlannerProvider(),
        searchService: makeSearchService([makeHit()]),
        answerProvider,
        metadata: {
          tenantId: 'tenant-a',
          debug: true,
          nested: { ignored: true }
        },
        idFactory: () => 'stream-metadata-run'
      })
    );

    expect(answerProvider.inputs[0]?.metadata.extra).toEqual({
      tenantId: 'tenant-a',
      debug: true
    });
  });
});
