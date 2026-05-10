import { describe, expect, it } from 'vitest';

import { buildKnowledgeEvalSamplesFromTraces, type KnowledgeRagTraceEvalSampleSignal } from '../src/eval';

const STARTED_AT = '2026-05-10T00:00:00.000Z';

describe('knowledge trace eval sample builder', () => {
  it('creates quality-signal eval samples from failed and empty retrieval traces', () => {
    const samples = buildKnowledgeEvalSamplesFromTraces([
      {
        traceId: 'trace-empty',
        operation: 'rag.run',
        status: 'succeeded',
        startedAt: STARTED_AT,
        events: [],
        query: { text: 'missing policy' },
        retrieval: { hits: [], citations: [] },
        metrics: [{ traceId: 'trace-empty', name: 'retrieval.hit_count', value: 0, unit: 'count', stage: 'retrieval' }]
      },
      {
        traceId: 'trace-failed',
        operation: 'retrieval.run',
        status: 'failed',
        startedAt: STARTED_AT,
        events: [
          {
            eventId: 'trace-failed:runtime.run.fail',
            traceId: 'trace-failed',
            name: 'runtime.run.fail',
            stage: 'retrieval',
            occurredAt: STARTED_AT,
            error: { code: 'SearchError', message: 'Search failed.', retryable: false, stage: 'retrieval' }
          }
        ],
        query: { text: 'approval evidence retention' },
        retrieval: { hits: [], citations: [] }
      }
    ]);

    expect(samples).toEqual([
      expect.objectContaining({
        sampleId: 'trace-empty:empty_retrieval',
        traceId: 'trace-empty',
        query: { text: 'missing policy' },
        observed: expect.objectContaining({ retrievalHits: [], citations: [] }),
        attributes: expect.objectContaining({
          signal: 'empty_retrieval',
          sourceOperation: 'rag.run',
          sourceStatus: 'succeeded'
        })
      }),
      expect.objectContaining({
        sampleId: 'trace-failed:runtime_run_failed',
        traceId: 'trace-failed',
        query: { text: 'approval evidence retention' },
        attributes: expect.objectContaining({
          signal: 'runtime_run_failed',
          sourceOperation: 'retrieval.run',
          sourceStatus: 'failed'
        })
      })
    ]);
  });

  it('creates samples for low grounded citation rate and indexing quality gate failures without raw answer text', () => {
    const samples = buildKnowledgeEvalSamplesFromTraces(
      [
        {
          traceId: 'trace-low-citation',
          operation: 'rag.run',
          status: 'succeeded',
          startedAt: STARTED_AT,
          events: [],
          query: { text: 'cite the recovery rule' },
          retrieval: {
            hits: [hit('chunk-recovery', 1)],
            citations: [citation('chunk-recovery')]
          },
          generation: {
            answerId: 'answer-low-citation',
            answerText: 'This raw answer must not be copied into the sample.',
            citedChunkIds: ['chunk-other'],
            groundedCitationRate: 0.2
          },
          metrics: [
            {
              traceId: 'trace-low-citation',
              name: 'generation.grounded_citation_rate',
              value: 0.2,
              unit: 'ratio',
              stage: 'generation'
            }
          ]
        },
        {
          traceId: 'trace-indexing-quality',
          operation: 'indexing.run',
          status: 'succeeded',
          startedAt: STARTED_AT,
          events: [],
          indexing: {
            knowledgeBaseId: 'kb-runtime',
            sourceId: 'source-runtime',
            chunkCount: 4,
            embeddedChunkCount: 4,
            storedChunkCount: 2
          },
          metrics: [
            {
              traceId: 'trace-indexing-quality',
              name: 'indexing.quality_gate.vector-writes-match-records',
              value: 0,
              unit: 'count',
              stage: 'indexing',
              attributes: {
                qualityGate: 'vector-writes-match-records',
                status: 'failed'
              }
            }
          ]
        }
      ],
      { lowGroundedCitationRateThreshold: 0.5 }
    );

    const signals = samples.map(sample => sample.attributes?.signal as KnowledgeRagTraceEvalSampleSignal);
    expect(signals).toEqual(['low_grounded_citation_rate', 'indexing_quality_gate_failed']);
    expect(samples[0]).toMatchObject({
      sampleId: 'trace-low-citation:low_grounded_citation_rate',
      observed: {
        retrievalHits: [expect.objectContaining({ chunkId: 'chunk-recovery' })],
        citations: [expect.objectContaining({ chunkId: 'chunk-recovery' })]
      },
      attributes: expect.objectContaining({
        signal: 'low_grounded_citation_rate',
        sourceOperation: 'rag.run',
        sourceStatus: 'succeeded',
        groundedCitationRate: 0.2
      })
    });
    expect(samples[0]?.observed).not.toHaveProperty('answerText');
    expect(samples[1]).toMatchObject({
      sampleId: 'trace-indexing-quality:indexing_quality_gate_failed',
      query: { text: 'indexing.run trace-indexing-quality' },
      attributes: expect.objectContaining({
        signal: 'indexing_quality_gate_failed',
        sourceOperation: 'indexing.run',
        sourceStatus: 'succeeded',
        qualityGate: 'vector-writes-match-records',
        qualityGateStatus: 'failed'
      })
    });
  });
});

function hit(chunkId: string, rank: number) {
  return {
    chunkId,
    documentId: `doc-${chunkId}`,
    sourceId: `source-${chunkId}`,
    rank
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
