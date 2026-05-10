import { describe, expect, it } from 'vitest';
import type { KnowledgeRagTrace } from '@agent/knowledge';

import { KnowledgeTraceService } from '../../src/domains/knowledge/services/knowledge-trace.service';

describe('KnowledgeTraceService', () => {
  it('records sanitized spans and returns cloned traces', () => {
    const service = new KnowledgeTraceService();
    const traceId = service.startTrace({ operation: 'rag.chat', knowledgeBaseId: 'kb_1' });

    service.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: {
        selectedCount: 2,
        reason: 'metadata-match',
        ignored: { nested: true } as unknown as string
      }
    });
    service.finishTrace(traceId, 'ok');

    const trace = service.getTrace(traceId);
    expect(trace).toMatchObject({
      traceId,
      operation: 'rag.chat',
      knowledgeBaseId: 'kb_1',
      status: 'ok',
      spans: [
        expect.objectContaining({
          name: 'route',
          status: 'ok',
          attributes: {
            selectedCount: 2,
            reason: 'metadata-match'
          }
        })
      ]
    });
    expect(trace?.spans[0]?.attributes).not.toHaveProperty('ignored');

    trace!.spans.length = 0;
    expect(service.getTrace(traceId)?.spans).toHaveLength(1);
  });

  it('projects SDK RAG trace into sanitized backend spans without vendor objects or secrets', () => {
    const service = new KnowledgeTraceService();
    const traceId = service.startTrace({ operation: 'rag.chat', knowledgeBaseId: 'kb_1' });
    const sdkTrace = {
      traceId: 'sdk_trace_1',
      runId: 'sdk_run_1',
      operation: 'rag.run',
      status: 'succeeded',
      startedAt: '2026-05-10T00:00:00.000Z',
      endedAt: '2026-05-10T00:00:01.000Z',
      attributes: {
        providerId: 'openai',
        apiKey: 'sk-should-not-leak',
        rawResponse: { token: 'vendor-secret' }
      },
      events: [
        {
          eventId: 'event_retrieval',
          traceId: 'sdk_trace_1',
          name: 'runtime.retrieval.complete',
          stage: 'retrieval',
          occurredAt: '2026-05-10T00:00:00.400Z',
          retrieval: {
            hits: [
              {
                chunkId: 'chunk_1',
                documentId: 'doc_1',
                sourceId: 'doc_1',
                knowledgeBaseId: 'kb_1',
                rank: 1,
                score: 0.9,
                title: 'Runbook'
              }
            ],
            citations: [],
            diagnostics: {
              retrievalMode: 'hybrid',
              candidateCount: 3,
              selectedCount: 1,
              latencyMs: 42
            }
          },
          attributes: {
            providerId: 'openai',
            authorization: 'Bearer secret',
            vendorObject: { token: 'secret' }
          }
        },
        {
          eventId: 'event_generation',
          traceId: 'sdk_trace_1',
          parentEventId: 'event_retrieval',
          name: 'runtime.generation.complete',
          stage: 'generation',
          occurredAt: '2026-05-10T00:00:00.900Z',
          generation: {
            answerId: 'sdk_run_1',
            answerText: 'Answer containing provider details that should not become an attribute.',
            citedChunkIds: ['chunk_1'],
            groundedCitationRate: 1
          }
        },
        {
          eventId: 'event_failure',
          traceId: 'sdk_trace_1',
          parentEventId: 'event_generation',
          name: 'runtime.run.fail',
          stage: 'generation',
          occurredAt: '2026-05-10T00:00:01.000Z',
          error: {
            code: 'ProviderError',
            message: 'Authorization: Bearer secret-token apiKey=sk-should-not-leak raw vendor body',
            retryable: false,
            stage: 'generation'
          }
        }
      ],
      retrieval: {
        hits: [],
        citations: []
      }
    } as unknown as KnowledgeRagTrace;

    service.projectSdkTrace(traceId, sdkTrace);
    service.finishTrace(traceId, 'ok');

    const trace = service.getTrace(traceId);
    expect(trace?.spans).toHaveLength(3);
    expect(trace?.spans[0]).toMatchObject({
      name: 'retrieve',
      status: 'ok',
      startedAt: '2026-05-10T00:00:00.400Z',
      endedAt: '2026-05-10T00:00:00.400Z',
      attributes: {
        sdkTraceId: 'sdk_trace_1',
        sdkEventName: 'runtime.retrieval.complete',
        sdkStage: 'retrieval',
        retrievalMode: 'hybrid',
        hitCount: 1,
        candidateCount: 3,
        selectedCount: 1,
        latencyMs: 42,
        providerId: 'openai'
      }
    });
    expect(trace?.spans[1]).toMatchObject({
      name: 'generate',
      status: 'ok',
      startedAt: '2026-05-10T00:00:00.900Z',
      endedAt: '2026-05-10T00:00:00.900Z',
      attributes: {
        sdkTraceId: 'sdk_trace_1',
        sdkEventName: 'runtime.generation.complete',
        sdkStage: 'generation',
        citedChunkCount: 1,
        groundedCitationRate: 1
      }
    });
    expect(JSON.stringify(trace)).not.toContain('sk-should-not-leak');
    expect(JSON.stringify(trace)).not.toContain('Bearer secret');
    expect(JSON.stringify(trace)).not.toContain('secret-token');
    expect(JSON.stringify(trace)).not.toContain('vendor-secret');
    expect(JSON.stringify(trace)).not.toContain('Answer containing provider details');
    expect(JSON.stringify(trace)).not.toContain('sk-should-not-leak');
    expect(trace?.spans[2]).toMatchObject({
      name: 'generate',
      status: 'error',
      error: {
        code: 'ProviderError',
        message: 'Knowledge RAG SDK event failed.'
      }
    });
  });
});
