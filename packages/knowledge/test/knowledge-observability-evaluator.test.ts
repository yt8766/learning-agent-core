import { describe, expect, it } from 'vitest';

import {
  buildKnowledgeEvalSampleFromTrace,
  evaluateKnowledgeEvalSamples,
  KnowledgeEvalMetricSummarySchema,
  type KnowledgeEvalSample,
  type KnowledgeRagTrace
} from '../src';

const CREATED_AT = '2026-05-10T09:00:00.000Z';

describe('knowledge observability evaluator', () => {
  it('computes retrieval, citation, and no-answer metrics for hit, miss, no-answer, and empty samples', () => {
    const samples: KnowledgeEvalSample[] = [
      buildSample({
        sampleId: 'sample-hit',
        expectedChunkIds: ['chunk-expected'],
        hits: [
          { chunkId: 'chunk-distractor', rank: 1 },
          { chunkId: 'chunk-expected', rank: 2 }
        ],
        citationChunkIds: ['chunk-expected'],
        answerText: '命中预期 chunk。'
      }),
      buildSample({
        sampleId: 'sample-miss',
        expectedChunkIds: ['chunk-missing'],
        hits: [{ chunkId: 'chunk-other', rank: 1 }],
        citationChunkIds: ['chunk-other'],
        answerText: '引用了错误 chunk。'
      }),
      buildSample({
        sampleId: 'sample-no-answer',
        expectedChunkIds: [],
        noAnswer: true,
        hits: [],
        citationChunkIds: [],
        answerText: ''
      }),
      buildSample({
        sampleId: 'sample-empty',
        expectedChunkIds: ['chunk-empty'],
        hits: [],
        citationChunkIds: [],
        answerText: ''
      })
    ];

    const summary = evaluateKnowledgeEvalSamples(samples, { topK: 2 });

    expect(KnowledgeEvalMetricSummarySchema.parse(summary)).toEqual(summary);
    expect(summary).toEqual({
      sampleCount: 4,
      topK: 2,
      recallAtK: 1 / 3,
      mrr: 1 / 6,
      emptyRetrievalRate: 1 / 2,
      groundedCitationRate: 1 / 2,
      noAnswerAccuracy: 1
    });
  });

  it('returns schema-valid zero metrics for an empty sample collection', () => {
    const summary = evaluateKnowledgeEvalSamples([], { topK: 5 });

    expect(KnowledgeEvalMetricSummarySchema.parse(summary)).toEqual({
      sampleCount: 0,
      topK: 5,
      recallAtK: 0,
      mrr: 0,
      emptyRetrievalRate: 0,
      groundedCitationRate: 0,
      noAnswerAccuracy: 0
    });
  });

  it('builds an eval sample from a RAG trace and explicit expected answer', () => {
    const trace: KnowledgeRagTrace = {
      traceId: 'trace-rag-1',
      runId: 'run-rag-1',
      operation: 'rag.run',
      status: 'succeeded',
      startedAt: '2026-05-10T08:59:00.000Z',
      events: [],
      query: {
        text: '如何验证 RAG eval？',
        normalizedText: '验证 rag eval'
      },
      retrieval: {
        requestedTopK: 3,
        hits: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            sourceId: 'source-1',
            rank: 1,
            citation: citation('chunk-1')
          }
        ],
        citations: [citation('chunk-1')],
        diagnostics: {
          retrievalMode: 'hybrid',
          selectedCount: 1
        }
      },
      generation: {
        answerText: '需要用 golden sample 验证。'
      },
      feedback: {
        label: 'grounded',
        source: 'evaluator'
      }
    };

    const sample = buildKnowledgeEvalSampleFromTrace(trace, {
      sampleId: 'sample-from-trace',
      datasetId: 'rag-golden',
      createdAt: CREATED_AT,
      expected: {
        chunkIds: ['chunk-1'],
        documentIds: ['doc-1'],
        citations: [citation('chunk-1')],
        answerFacts: ['需要用 golden sample 验证']
      },
      attributes: {
        source: 'trace-builder-test'
      }
    });

    expect(sample).toEqual({
      sampleId: 'sample-from-trace',
      datasetId: 'rag-golden',
      traceId: 'trace-rag-1',
      createdAt: CREATED_AT,
      query: trace.query,
      expected: {
        chunkIds: ['chunk-1'],
        documentIds: ['doc-1'],
        citations: [citation('chunk-1')],
        answerFacts: ['需要用 golden sample 验证']
      },
      observed: {
        retrievalHits: trace.retrieval?.hits,
        citations: trace.retrieval?.citations,
        answerText: trace.generation?.answerText,
        diagnostics: trace.retrieval?.diagnostics
      },
      feedback: trace.feedback,
      attributes: {
        source: 'trace-builder-test'
      }
    });
  });
});

function buildSample(input: {
  sampleId: string;
  expectedChunkIds: string[];
  hits: Array<{ chunkId: string; rank: number }>;
  citationChunkIds: string[];
  answerText: string;
  noAnswer?: boolean;
}): KnowledgeEvalSample {
  return {
    sampleId: input.sampleId,
    createdAt: CREATED_AT,
    query: {
      text: `query for ${input.sampleId}`
    },
    expected: {
      chunkIds: input.expectedChunkIds,
      documentIds: input.expectedChunkIds.map(chunkId => `doc-${chunkId}`),
      citations: input.expectedChunkIds.map(citation),
      answerFacts: [],
      noAnswer: input.noAnswer
    },
    observed: {
      retrievalHits: input.hits.map(hit => ({
        chunkId: hit.chunkId,
        documentId: `doc-${hit.chunkId}`,
        sourceId: `source-${hit.chunkId}`,
        rank: hit.rank
      })),
      citations: input.citationChunkIds.map(citation),
      answerText: input.answerText
    }
  };
}

function citation(chunkId: string) {
  return {
    sourceId: `source-${chunkId}`,
    chunkId,
    title: `Title ${chunkId}`,
    uri: `docs/${chunkId}.md`,
    sourceType: 'repo-docs' as const,
    trustClass: 'internal' as const
  };
}
