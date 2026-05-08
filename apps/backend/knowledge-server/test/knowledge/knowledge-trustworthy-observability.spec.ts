import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeFrontendMvpController } from '../../src/knowledge/knowledge-frontend-mvp.controller';
import { KnowledgeProviderHealthService } from '../../src/knowledge/knowledge-provider-health.service';
import type { KnowledgeTraceAttributes } from '../../src/knowledge/knowledge-trace.service';
import { KnowledgeTraceService } from '../../src/knowledge/knowledge-trace.service';

describe('KnowledgeTraceService', () => {
  it('records route and retrieve spans with JSON-safe attributes and returns newest traces first', () => {
    vi.useFakeTimers();
    try {
      const service = new KnowledgeTraceService();
      vi.setSystemTime(new Date('2026-05-03T08:00:00.000Z'));
      const olderTraceId = service.startTrace({
        operation: 'rag.chat',
        knowledgeBaseId: 'kb_1',
        documentId: 'doc_1'
      });
      service.addSpan(olderTraceId, {
        name: 'route',
        status: 'ok',
        attributes: {
          mode: 'hybrid',
          candidateCount: 2,
          accepted: true,
          provider: null
        }
      });
      service.addSpan(olderTraceId, {
        name: 'retrieve',
        status: 'ok',
        attributes: { topK: 5 }
      });
      service.finishTrace(olderTraceId, 'ok');

      vi.setSystemTime(new Date('2026-05-03T08:01:00.000Z'));
      const newerTraceId = service.startTrace({ operation: 'provider.health' });

      expect(service.getTrace(olderTraceId)).toMatchObject({
        traceId: olderTraceId,
        operation: 'rag.chat',
        knowledgeBaseId: 'kb_1',
        documentId: 'doc_1',
        status: 'ok',
        startedAt: '2026-05-03T08:00:00.000Z',
        endedAt: '2026-05-03T08:00:00.000Z',
        spans: [
          expect.objectContaining({
            spanId: expect.any(String),
            name: 'route',
            status: 'ok',
            startedAt: '2026-05-03T08:00:00.000Z',
            endedAt: '2026-05-03T08:00:00.000Z',
            attributes: { mode: 'hybrid', candidateCount: 2, accepted: true, provider: null }
          }),
          expect.objectContaining({
            spanId: expect.any(String),
            name: 'retrieve',
            status: 'ok',
            attributes: { topK: 5 }
          })
        ]
      });
      expect(service.listTraces().map(trace => trace.traceId)).toEqual([newerTraceId, olderTraceId]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores spans for unknown traces without throwing', () => {
    const service = new KnowledgeTraceService();

    expect(() => {
      service.addSpan('missing_trace', {
        name: 'route',
        status: 'ok',
        attributes: { ignored: true }
      });
    }).not.toThrow();
    expect(service.listTraces()).toEqual([]);
  });

  it('sanitizes span attributes at runtime before storing them', () => {
    const service = new KnowledgeTraceService();
    const traceId = service.startTrace({ operation: 'rag.chat' });

    service.addSpan(traceId, {
      name: 'route',
      status: 'ok',
      attributes: {
        accepted: true,
        nested: { vendor: 'payload' },
        secret: ['token']
      } as unknown as KnowledgeTraceAttributes
    });

    expect(service.getTrace(traceId)?.spans[0]?.attributes).toEqual({ accepted: true });
  });

  it('returns cloned traces so callers cannot mutate the store', () => {
    const service = new KnowledgeTraceService();
    const traceId = service.startTrace({ operation: 'rag.chat' });
    service.addSpan(traceId, { name: 'retrieve', status: 'ok', attributes: { topK: 3 } });

    const trace = service.getTrace(traceId);
    trace!.status = 'error';
    trace!.spans[0]!.attributes = { topK: 99 };

    expect(service.getTrace(traceId)).toMatchObject({
      status: 'ok',
      spans: [expect.objectContaining({ attributes: { topK: 3 } })]
    });
  });

  it('keeps the in-memory trace store bounded to the latest traces', () => {
    vi.useFakeTimers();
    try {
      const service = new KnowledgeTraceService();
      const firstTraceIds: string[] = [];

      for (let index = 0; index < 205; index += 1) {
        vi.setSystemTime(new Date(Date.UTC(2026, 4, 3, 8, 0, index)));
        const traceId = service.startTrace({ operation: 'rag.chat', knowledgeBaseId: `kb_${index}` });
        if (index < 5) {
          firstTraceIds.push(traceId);
        }
      }

      const traces = service.listTraces();
      expect(traces).toHaveLength(200);
      expect(traces.map(trace => trace.traceId)).not.toEqual(expect.arrayContaining(firstTraceIds));
      expect(traces[0]).toMatchObject({ knowledgeBaseId: 'kb_204' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('KnowledgeProviderHealthService', () => {
  it('summarizes configured probes and marks missing probes as unconfigured', async () => {
    const service = new KnowledgeProviderHealthService({
      embedding: async () => ({ status: 'ok', message: 'embedding ready' }),
      vector: async () => ({ status: 'degraded', message: 'vector slow' })
    });

    await expect(service.getProviderHealth()).resolves.toEqual({
      embedding: 'ok',
      vector: 'degraded',
      keyword: 'unconfigured',
      generation: 'unconfigured'
    });
  });

  it('marks throwing probes as degraded without leaking vendor errors', async () => {
    const service = new KnowledgeProviderHealthService({
      keyword: async () => {
        throw new Error('vendor timeout with secret token');
      },
      generation: async () => ({ status: 'ok' })
    });

    await expect(service.getProviderHealth()).resolves.toEqual({
      embedding: 'unconfigured',
      vector: 'unconfigured',
      keyword: 'degraded',
      generation: 'ok'
    });
  });
});

describe('KnowledgeFrontendMvpController observability traces', () => {
  it('projects traces from KnowledgeTraceService through list and detail endpoints', () => {
    const traces = new KnowledgeTraceService();
    const controller = new KnowledgeFrontendMvpController(undefined, traces);
    const traceId = traces.startTrace({ operation: 'rag.chat', knowledgeBaseId: 'kb_frontend' });
    traces.addSpan(traceId, { name: 'route', status: 'ok', attributes: { route: 'direct' } });
    traces.finishTrace(traceId, 'ok');

    expect(controller.listTraces()).toEqual({
      items: [
        expect.objectContaining({
          id: traceId,
          knowledgeBaseIds: ['kb_frontend'],
          status: 'succeeded'
        })
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
    expect(controller.getTrace(traceId)).toEqual(
      expect.objectContaining({
        id: traceId,
        citations: [],
        spans: [
          expect.objectContaining({
            id: expect.any(String),
            traceId,
            name: 'route',
            status: 'succeeded',
            input: { data: { route: 'direct' } }
          })
        ]
      })
    );
  });

  it('returns a 404 when a requested trace is missing', () => {
    const controller = new KnowledgeFrontendMvpController(undefined, new KnowledgeTraceService());

    expect(() => controller.getTrace('missing_trace')).toThrow(NotFoundException);
  });
});
