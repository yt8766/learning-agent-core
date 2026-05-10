import { describe, expect, it } from 'vitest';

import {
  KnowledgeRagTraceSchema,
  createInMemoryKnowledgeRagObserver,
  exportKnowledgeRagTrace,
  finishKnowledgeRagTrace,
  listKnowledgeRagTraces,
  recordKnowledgeRagEvent,
  startKnowledgeRagTrace,
  tryFinishKnowledgeRagTrace,
  tryRecordKnowledgeRagEvent,
  tryStartKnowledgeRagTrace
} from '../src/index';

describe('knowledge observability runtime', () => {
  it('parses runtime metrics on a RAG trace', () => {
    const trace = KnowledgeRagTraceSchema.parse({
      traceId: 'trace-metrics',
      operation: 'rag.run',
      status: 'succeeded',
      startedAt: '2026-05-10T00:00:00.000Z',
      endedAt: '2026-05-10T00:00:01.000Z',
      events: [],
      metrics: [
        { traceId: 'trace-metrics', name: 'runtime.duration_ms', value: 1000, unit: 'ms', stage: 'generation' },
        { traceId: 'trace-metrics', name: 'retrieval.hit_count', value: 3, unit: 'count', stage: 'retrieval' }
      ]
    });

    expect(trace.metrics).toHaveLength(2);
  });

  it('records schema-safe events and exports a parsed trace snapshot', () => {
    const observer = createInMemoryKnowledgeRagObserver();

    startKnowledgeRagTrace(observer, {
      traceId: 'trace-runtime-1',
      operation: 'rag.run',
      startedAt: '2026-05-10T09:00:00.000Z',
      query: {
        text: '如何观察 RAG 检索？'
      },
      attributes: {
        tenant: 'internal',
        sampleRate: 1
      }
    });

    recordKnowledgeRagEvent(observer, {
      eventId: 'event-query',
      traceId: 'trace-runtime-1',
      name: 'runtime.query.receive',
      stage: 'pre-retrieval',
      occurredAt: '2026-05-10T09:00:00.100Z',
      query: {
        text: '如何观察 RAG 检索？'
      }
    });

    recordKnowledgeRagEvent(observer, {
      eventId: 'event-retrieval',
      traceId: 'trace-runtime-1',
      parentEventId: 'event-query',
      name: 'runtime.retrieval.complete',
      stage: 'retrieval',
      occurredAt: '2026-05-10T09:00:01.000Z',
      retrieval: {
        requestedTopK: 3,
        hits: [],
        citations: [],
        diagnostics: {
          retrievalMode: 'none',
          candidateCount: 0,
          selectedCount: 0,
          latencyMs: 900
        }
      }
    });

    finishKnowledgeRagTrace(observer, 'trace-runtime-1', {
      status: 'succeeded',
      endedAt: '2026-05-10T09:00:02.000Z'
    });

    const exported = exportKnowledgeRagTrace(observer, 'trace-runtime-1');
    const parsed = KnowledgeRagTraceSchema.parse(exported);

    expect(parsed.status).toBe('succeeded');
    expect(parsed.events.map(event => event.eventId)).toEqual(['event-query', 'event-retrieval']);
    expect(parsed.events[1]?.retrieval?.diagnostics?.latencyMs).toBe(900);
  });

  it('exposes safe observer wrappers that isolate observability failures', () => {
    const observer = createInMemoryKnowledgeRagObserver();

    expect(
      tryStartKnowledgeRagTrace(observer, {
        traceId: 'trace-safe-wrapper-invalid',
        operation: 'rag.run',
        startedAt: '2026-05-10T09:01:00.000Z',
        attributes: {
          apiKey: 'raw-secret'
        }
      })
    ).toBeUndefined();
    expect(listKnowledgeRagTraces(observer)).toHaveLength(0);

    expect(
      tryStartKnowledgeRagTrace(observer, {
        traceId: 'trace-safe-wrapper',
        operation: 'rag.run',
        startedAt: '2026-05-10T09:02:00.000Z'
      })
    ).toMatchObject({ traceId: 'trace-safe-wrapper' });

    expect(
      tryRecordKnowledgeRagEvent(observer, {
        eventId: 'event-safe-wrapper-invalid',
        traceId: 'trace-safe-wrapper',
        name: 'runtime.run.fail',
        stage: 'generation',
        occurredAt: '2026-05-10T09:02:01.000Z',
        attributes: {
          vendorError: new Error('raw vendor object')
        }
      })
    ).toBeUndefined();
    expect(exportKnowledgeRagTrace(observer, 'trace-safe-wrapper').events).toHaveLength(0);

    expect(
      tryFinishKnowledgeRagTrace(observer, 'trace-safe-wrapper-missing', {
        status: 'succeeded',
        endedAt: '2026-05-10T09:02:02.000Z'
      })
    ).toBeUndefined();
  });

  it('rejects raw vendor objects and secret-bearing attributes before export', () => {
    const observer = createInMemoryKnowledgeRagObserver();

    startKnowledgeRagTrace(observer, {
      traceId: 'trace-invalid-attributes',
      operation: 'retrieval.run',
      startedAt: '2026-05-10T09:05:00.000Z'
    });

    expect(() =>
      recordKnowledgeRagEvent(observer, {
        eventId: 'event-invalid',
        traceId: 'trace-invalid-attributes',
        name: 'runtime.run.fail',
        stage: 'retrieval',
        occurredAt: '2026-05-10T09:05:01.000Z',
        attributes: {
          authorization: 'Bearer raw-secret',
          vendorError: new Error('sdk exploded')
        }
      })
    ).toThrow(/Trace attributes must not include raw secret-bearing keys|JSON-safe/);

    const exported = exportKnowledgeRagTrace(observer, 'trace-invalid-attributes');

    expect(exported.events).toHaveLength(0);
  });

  it('rejects nested secret-bearing attribute keys before storing the event', () => {
    const observer = createInMemoryKnowledgeRagObserver();

    startKnowledgeRagTrace(observer, {
      traceId: 'trace-nested-secret',
      operation: 'retrieval.run',
      startedAt: '2026-05-10T09:10:00.000Z'
    });

    expect(() =>
      recordKnowledgeRagEvent(observer, {
        eventId: 'event-nested-secret',
        traceId: 'trace-nested-secret',
        name: 'runtime.retrieval.start',
        stage: 'retrieval',
        occurredAt: '2026-05-10T09:10:01.000Z',
        attributes: {
          provider: {
            apiKey: 'raw-secret'
          }
        }
      })
    ).toThrow(/secret-bearing keys/);

    expect(exportKnowledgeRagTrace(observer, 'trace-nested-secret').events).toHaveLength(0);
  });
});
