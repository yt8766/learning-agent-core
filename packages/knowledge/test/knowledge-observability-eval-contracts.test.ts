import { describe, expect, it } from 'vitest';

import {
  KnowledgeEvalMetricSummarySchema,
  KnowledgeEvalSampleSchema,
  KnowledgeRagEventSchema,
  KnowledgeRagTraceSchema
} from '../src/contracts';
import type { KnowledgeEvalSample, KnowledgeRagEvent, KnowledgeRagTrace } from '../src/contracts';
import * as rootExports from '../src/index';

describe('knowledge observability and eval contracts', () => {
  it('re-exports observability and eval schemas through the root SDK entrypoint', () => {
    expect(rootExports.KnowledgeRagEventSchema).toBe(KnowledgeRagEventSchema);
    expect(rootExports.KnowledgeRagTraceSchema).toBe(KnowledgeRagTraceSchema);
    expect(rootExports.KnowledgeEvalSampleSchema).toBe(KnowledgeEvalSampleSchema);
    expect(rootExports.KnowledgeEvalMetricSummarySchema).toBe(KnowledgeEvalMetricSummarySchema);
  });

  it('parses a minimal retrieval trace with query, hits, citations, diagnostics, and feedback', () => {
    const event = KnowledgeRagEventSchema.parse({
      eventId: 'event-retrieval-complete',
      traceId: 'trace-rag-1',
      name: 'runtime.retrieval.complete',
      stage: 'retrieval',
      occurredAt: '2026-05-10T08:00:01.000Z',
      query: {
        text: '如何验证 hybrid retrieval？',
        normalizedText: '验证 hybrid retrieval',
        variants: ['hybrid retrieval recall', 'RRF fusion']
      },
      retrieval: {
        requestedTopK: 5,
        hits: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            sourceId: 'source-1',
            knowledgeBaseId: 'kb-1',
            rank: 1,
            score: 0.91,
            title: 'Knowledge RAG Hardening',
            uri: 'docs/superpowers/specs/2026-05-10-knowledge-rag-hardening-design.md',
            citation: {
              sourceId: 'source-1',
              chunkId: 'chunk-1',
              title: 'Knowledge RAG Hardening',
              uri: 'docs/superpowers/specs/2026-05-10-knowledge-rag-hardening-design.md',
              sourceType: 'repo-docs',
              trustClass: 'internal'
            }
          }
        ],
        citations: [
          {
            sourceId: 'source-1',
            chunkId: 'chunk-1',
            title: 'Knowledge RAG Hardening',
            uri: 'docs/superpowers/specs/2026-05-10-knowledge-rag-hardening-design.md',
            sourceType: 'repo-docs',
            trustClass: 'internal'
          }
        ],
        diagnostics: {
          retrievalMode: 'hybrid',
          enabledRetrievers: ['keyword', 'vector'],
          failedRetrievers: [],
          fusionStrategy: 'rrf',
          candidateCount: 12,
          selectedCount: 5
        }
      },
      feedback: {
        label: 'positive',
        source: 'user',
        comment: '命中预期文档'
      }
    });

    expect(event.retrieval?.diagnostics?.retrievalMode).toBe('hybrid');
    expect(event.retrieval?.hits[0]?.citation?.chunkId).toBe('chunk-1');

    const trace = KnowledgeRagTraceSchema.parse({
      traceId: 'trace-rag-1',
      operation: 'rag.run',
      status: 'succeeded',
      startedAt: '2026-05-10T08:00:00.000Z',
      endedAt: '2026-05-10T08:00:02.000Z',
      query: event.query,
      events: [event],
      feedback: event.feedback
    });

    const typeSmoke: {
      event: KnowledgeRagEvent;
      trace: KnowledgeRagTrace;
    } = { event, trace };

    expect(typeSmoke.trace.events).toHaveLength(1);
  });

  it('parses eval samples and metric summaries without requiring a full eval platform', () => {
    const sample = KnowledgeEvalSampleSchema.parse({
      sampleId: 'sample-1',
      datasetId: 'rag-hardening-golden',
      traceId: 'trace-rag-1',
      createdAt: '2026-05-10T08:01:00.000Z',
      query: {
        text: 'hybrid retrieval 的 Recall@K 应如何验证？'
      },
      expected: {
        chunkIds: ['chunk-1'],
        documentIds: ['doc-1'],
        answerFacts: ['hybrid retrieval 应同时使用 keyword 和 vector 召回'],
        noAnswer: false
      },
      observed: {
        retrievalHits: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            sourceId: 'source-1',
            rank: 1,
            score: 0.91
          }
        ],
        citations: [
          {
            sourceId: 'source-1',
            chunkId: 'chunk-1',
            title: 'Knowledge RAG Hardening',
            uri: 'docs/superpowers/specs/2026-05-10-knowledge-rag-hardening-design.md',
            sourceType: 'repo-docs',
            trustClass: 'internal'
          }
        ],
        diagnostics: {
          retrievalMode: 'hybrid',
          candidateCount: 12,
          selectedCount: 5
        }
      },
      feedback: {
        label: 'grounded',
        source: 'evaluator'
      }
    });

    const metrics = KnowledgeEvalMetricSummarySchema.parse({
      sampleCount: 1,
      topK: 5,
      recallAtK: 1,
      mrr: 1,
      emptyRetrievalRate: 0,
      groundedCitationRate: 1,
      noAnswerAccuracy: 1
    });

    const typeSmoke: KnowledgeEvalSample = sample;

    expect(typeSmoke.expected.chunkIds).toEqual(['chunk-1']);
    expect(metrics.recallAtK).toBe(1);
  });

  it('allows empty retrieval diagnostics for no-hit traces', () => {
    const trace = KnowledgeRagTraceSchema.parse({
      traceId: 'trace-no-hit',
      operation: 'retrieval.run',
      status: 'succeeded',
      startedAt: '2026-05-10T08:03:00.000Z',
      retrieval: {
        requestedTopK: 5,
        hits: [],
        citations: [],
        diagnostics: {
          retrievalMode: 'none',
          enabledRetrievers: ['keyword', 'vector'],
          failedRetrievers: [],
          candidateCount: 0,
          selectedCount: 0
        }
      }
    });

    expect(trace.retrieval?.diagnostics?.retrievalMode).toBe('none');
  });

  it('rejects non JSON-safe trace attributes so vendor objects and secrets do not cross the SDK boundary', () => {
    expect(() =>
      KnowledgeRagEventSchema.parse({
        eventId: 'event-invalid',
        traceId: 'trace-invalid',
        name: 'runtime.run.fail',
        stage: 'generation',
        occurredAt: '2026-05-10T08:02:00.000Z',
        attributes: {
          vendorError: new Error('raw vendor error')
        }
      })
    ).toThrow(/JSON-safe/);
  });

  it('rejects nested secret-bearing trace attributes at the schema boundary', () => {
    expect(() =>
      KnowledgeRagEventSchema.parse({
        eventId: 'event-nested-secret',
        traceId: 'trace-invalid',
        name: 'runtime.run.fail',
        stage: 'retrieval',
        occurredAt: '2026-05-10T08:04:00.000Z',
        attributes: {
          provider: {
            apiKey: 'raw-secret'
          }
        }
      })
    ).toThrow(/secret-bearing keys/);
  });
});
