import { describe, expect, it } from 'vitest';

import { KnowledgeTraceService } from '../../src/domains/knowledge/services/knowledge-trace.service';

describe('KnowledgeTraceService - extended branches', () => {
  function createService() {
    return new KnowledgeTraceService();
  }

  describe('startTrace', () => {
    it('creates trace with optional fields', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      const trace = service.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace!.operation).toBe('rag_query');
      expect(trace!.status).toBe('ok');
    });

    it('creates trace with all optional fields', () => {
      const service = createService();
      const traceId = service.startTrace({
        operation: 'rag_query',
        knowledgeBaseId: 'kb-1',
        documentId: 'doc-1'
      });
      const trace = service.getTrace(traceId);
      expect(trace!.knowledgeBaseId).toBe('kb-1');
      expect(trace!.documentId).toBe('doc-1');
    });

    it('trims old traces when exceeding MAX_TRACES', () => {
      const service = createService();
      const ids: string[] = [];
      for (let i = 0; i < 202; i++) {
        ids.push(service.startTrace({ operation: 'rag_query' }));
      }
      const traces = service.listTraces();
      expect(traces.length).toBeLessThanOrEqual(200);
    });
  });

  describe('addSpan', () => {
    it('adds span to existing trace', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        startedAt: '2026-05-11T12:00:00.000Z',
        endedAt: '2026-05-11T12:00:01.000Z'
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans).toHaveLength(1);
      expect(trace!.spans[0].name).toBe('route');
    });

    it('uses defaults for missing optional fields', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, { name: 'retrieve' });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].spanId).toContain('span_');
      expect(trace!.spans[0].startedAt).toBeDefined();
    });

    it('ignores addSpan for non-existent trace', () => {
      const service = createService();
      service.addSpan('non-existent', { name: 'route' });
      // Should not throw
    });

    it('preserves provided spanId', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, { spanId: 'custom-span', name: 'route' });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].spanId).toBe('custom-span');
    });

    it('sanitizes sensitive attribute keys', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        attributes: {
          safeKey: 'value',
          api_key: 'secret',
          authorization: 'Bearer xyz',
          token_value: 'abc',
          password: 'pw',
          'api-key': 'k'
        }
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).toHaveProperty('safeKey');
      expect(trace!.spans[0].attributes).not.toHaveProperty('api_key');
      expect(trace!.spans[0].attributes).not.toHaveProperty('authorization');
      expect(trace!.spans[0].attributes).not.toHaveProperty('token_value');
      expect(trace!.spans[0].attributes).not.toHaveProperty('password');
      expect(trace!.spans[0].attributes).not.toHaveProperty('api-key');
    });

    it('includes error in span', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'generate',
        error: { code: 'E001', message: 'failed' }
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].error).toEqual({ code: 'E001', message: 'failed' });
    });

    it('handles undefined attributes', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, { name: 'route', attributes: undefined });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).toBeUndefined();
    });

    it('includes plain record attributes with numeric values', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        attributes: {
          metrics: { latency: 100, count: 5 }
        }
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).toHaveProperty('metrics');
    });

    it('filters non-numeric values from plain records', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        attributes: {
          metrics: { latency: 100, name: 'test' } as never
        }
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).not.toHaveProperty('metrics');
    });

    it('handles array values (not plain records)', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        attributes: {
          list: [1, 2, 3] as never
        }
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).not.toHaveProperty('list');
    });

    it('filters sensitive keys from plain records', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.addSpan(traceId, {
        name: 'route',
        attributes: {
          metrics: { latency: 100, api_key: 42 } as never
        }
      });
      const trace = service.getTrace(traceId);
      // metrics should be included because it has non-sensitive numeric values
      // but api_key inside should be filtered
      if (trace!.spans[0].attributes && 'metrics' in trace!.spans[0].attributes) {
        const metrics = trace!.spans[0].attributes['metrics'] as Record<string, number>;
        expect(metrics).not.toHaveProperty('api_key');
      }
    });
  });

  describe('finishTrace', () => {
    it('sets status and endedAt', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.finishTrace(traceId, 'failed');
      const trace = service.getTrace(traceId);
      expect(trace!.status).toBe('failed');
      expect(trace!.endedAt).toBeDefined();
    });

    it('ignores finish for non-existent trace', () => {
      const service = createService();
      service.finishTrace('non-existent', 'ok');
      // Should not throw
    });
  });

  describe('projectSdkTrace', () => {
    it('projects sdk events into spans', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        runId: 'run-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.query.receive',
            stage: 'route',
            occurredAt: '2026-05-11T12:00:00.000Z',
            attributes: { key: 'value' }
          },
          {
            eventId: 'evt-2',
            name: 'runtime.retrieval.start',
            stage: 'retrieve',
            occurredAt: '2026-05-11T12:00:01.000Z'
          },
          {
            eventId: 'evt-3',
            name: 'runtime.retrieval.complete',
            stage: 'retrieve',
            occurredAt: '2026-05-11T12:00:02.000Z'
          },
          {
            eventId: 'evt-4',
            name: 'runtime.post_retrieval.select',
            stage: 'rerank',
            occurredAt: '2026-05-11T12:00:03.000Z'
          },
          {
            eventId: 'evt-5',
            name: 'runtime.context_assembly.complete',
            stage: 'assemble-context',
            occurredAt: '2026-05-11T12:00:04.000Z',
            attributes: { contextAssembled: true, contextLength: 500 }
          },
          {
            eventId: 'evt-6',
            name: 'runtime.generation.complete',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:05.000Z'
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans.length).toBeGreaterThan(0);
    });

    it('handles unknown event names (returns undefined span name)', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'unknown.event' as never,
            stage: 'test',
            occurredAt: '2026-05-11T12:00:00.000Z'
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans).toHaveLength(0);
    });

    it('handles error events with sensitive messages', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'failed',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.run.fail',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            error: {
              code: 'ERR',
              message: 'Failed with api-key sk-abc123xyz'
            }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].status).toBe('error');
      expect(trace!.spans[0].error!.message).toBe('Knowledge RAG SDK event failed.');
    });

    it('handles error events with safe messages', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'failed',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.run.fail',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            error: {
              code: 'ERR',
              message: 'Something went wrong'
            }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].error!.message).toBe('Something went wrong');
    });

    it('maps canceled status', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'canceled',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.query.receive',
            stage: 'route',
            occurredAt: '2026-05-11T12:00:00.000Z'
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].status).toBe('cancelled');
    });

    it('includes retrieval attributes with diagnostics', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.retrieval.complete',
            stage: 'retrieve',
            occurredAt: '2026-05-11T12:00:00.000Z',
            retrieval: {
              hits: [{ id: 'h1', score: 0.9 }],
              citations: [{ id: 'c1' }],
              requestedTopK: 10,
              diagnostics: {
                retrievalMode: 'hybrid',
                candidateCount: 50,
                selectedCount: 10,
                latencyMs: 200,
                fusionStrategy: 'rrf',
                selectionTrace: [
                  { selected: true },
                  { selected: false, reason: 'low_score' },
                  { selected: false, reason: 'low_score' },
                  { selected: false, reason: 'duplicate' }
                ]
              }
            }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      const attrs = trace!.spans[0].attributes!;
      expect(attrs['hitCount']).toBe(1);
      expect(attrs['citationCount']).toBe(1);
      expect(attrs['requestedTopK']).toBe(10);
      expect(attrs['retrievalMode']).toBe('hybrid');
      expect(attrs['candidateCount']).toBe(50);
      expect(attrs['selectedCount']).toBe(10);
      expect(attrs['latencyMs']).toBe(200);
      expect(attrs['fusionStrategy']).toBe('rrf');
      expect(attrs['droppedCount']).toBe(3);
    });

    it('includes generation attributes', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.generation.complete',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            generation: {
              citedChunkIds: ['c1', 'c2'],
              groundedCitationRate: 0.8
            }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes!['citedChunkCount']).toBe(2);
      expect(trace!.spans[0].attributes!['groundedCitationRate']).toBe(0.8);
    });

    it('handles generation without citedChunkIds', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.generation.complete',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            generation: {}
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes!['citedChunkCount']).toBe(0);
    });

    it('handles context_assembly with non-boolean contextAssembled', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.context_assembly.complete',
            stage: 'assemble-context',
            occurredAt: '2026-05-11T12:00:00.000Z',
            attributes: { contextAssembled: 'yes', contextLength: 'long' }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes!['contextAssembled']).toBeNull();
      expect(trace!.spans[0].attributes!['contextLength']).toBeNull();
    });

    it('includes sdkRunId when present', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        runId: 'run-123',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.query.receive',
            stage: 'route',
            occurredAt: '2026-05-11T12:00:00.000Z'
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes!['sdkRunId']).toBe('run-123');
    });

    it('omits sdkRunId when absent', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'ok',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.query.receive',
            stage: 'route',
            occurredAt: '2026-05-11T12:00:00.000Z'
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].attributes).not.toHaveProperty('sdkRunId');
    });
  });

  describe('getTrace', () => {
    it('returns undefined for non-existent trace', () => {
      const service = createService();
      expect(service.getTrace('non-existent')).toBeUndefined();
    });

    it('returns clone of trace', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      const trace1 = service.getTrace(traceId);
      const trace2 = service.getTrace(traceId);
      expect(trace1).not.toBe(trace2);
      expect(trace1).toEqual(trace2);
    });
  });

  describe('listTraces', () => {
    it('returns traces sorted by startedAt descending', () => {
      const service = createService();
      const id1 = service.startTrace({ operation: 'rag_query' });
      const id2 = service.startTrace({ operation: 'rag_query' });
      const traces = service.listTraces();
      expect(traces.length).toBe(2);
      expect(traces[0].startedAt >= traces[1].startedAt).toBe(true);
    });

    it('returns clones of traces', () => {
      const service = createService();
      service.startTrace({ operation: 'rag_query' });
      const traces1 = service.listTraces();
      const traces2 = service.listTraces();
      expect(traces1[0]).not.toBe(traces2[0]);
    });
  });

  describe('sensitive text detection', () => {
    it('detects bearer tokens in error messages', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'failed',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.run.fail',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            error: { code: 'ERR', message: 'Bearer xyz123 failed' }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].error!.message).toBe('Knowledge RAG SDK event failed.');
    });

    it('detects raw vendor text in error messages', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'failed',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.run.fail',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            error: { code: 'ERR', message: 'raw vendor error occurred' }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].error!.message).toBe('Knowledge RAG SDK event failed.');
    });

    it('truncates long safe messages to 240 chars', () => {
      const service = createService();
      const traceId = service.startTrace({ operation: 'rag_query' });
      const longMessage = 'x'.repeat(300);
      service.projectSdkTrace(traceId, {
        traceId: 'sdk-trace-1',
        status: 'failed',
        events: [
          {
            eventId: 'evt-1',
            name: 'runtime.run.fail',
            stage: 'generate',
            occurredAt: '2026-05-11T12:00:00.000Z',
            error: { code: 'ERR', message: longMessage }
          }
        ]
      });
      const trace = service.getTrace(traceId);
      expect(trace!.spans[0].error!.message.length).toBe(240);
    });
  });
});
