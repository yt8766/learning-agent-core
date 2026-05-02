import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import type { KnowledgeTraceRecord } from '../../src/knowledge/interfaces/knowledge-records.types';
import { KnowledgeObservabilityService } from '../../src/knowledge/knowledge-observability.service';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';

const baseTime = '2026-05-01T09:00:00.000Z';

describe('KnowledgeObservabilityService', () => {
  it('returns stable zero metrics when the repository has no traces', async () => {
    const service = new KnowledgeObservabilityService({ repo: new InMemoryKnowledgeRepository() });

    await expect(service.getMetrics({ tenantId: 'tenant-empty' })).resolves.toEqual({
      traceCount: 0,
      questionCount: 0,
      averageLatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      errorRate: 0,
      timeoutRate: 0,
      noAnswerRate: 0,
      negativeFeedbackRate: 0,
      citationClickRate: 0,
      stageLatency: []
    });
  });

  it('calculates deterministic latency, rate, and span metrics from repository traces', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeObservabilityService({ repo });

    await repo.createTrace(
      trace({
        id: 'trace-1',
        latencyMs: 100,
        status: 'succeeded',
        answer: 'answer 1',
        spans: [
          { name: 'retrieval', status: 'succeeded', latencyMs: 50 },
          { name: 'generation', status: 'succeeded', latencyMs: 100 }
        ]
      })
    );
    await repo.createTrace(
      trace({
        id: 'trace-2',
        latencyMs: 200,
        status: 'succeeded',
        answer: '',
        spans: [
          { name: 'retrieval', status: 'succeeded', latencyMs: 100 },
          { name: 'generation', status: 'succeeded', latencyMs: 250 }
        ]
      })
    );
    await repo.createTrace(
      trace({ id: 'trace-3', latencyMs: 300, status: 'failed', errorMessage: 'provider timeout', spans: [] })
    );
    await repo.createTrace(
      trace({ id: 'trace-4', latencyMs: 400, status: 'failed', errorMessage: 'model failed', spans: [] })
    );

    await expect(service.getMetrics({ tenantId: 'tenant-1' })).resolves.toEqual({
      traceCount: 4,
      questionCount: 4,
      averageLatencyMs: 250,
      p95LatencyMs: 400,
      p99LatencyMs: 400,
      errorRate: 0.5,
      timeoutRate: 0.25,
      noAnswerRate: 0.25,
      negativeFeedbackRate: 0,
      citationClickRate: 0,
      stageLatency: [
        { stage: 'generation', averageLatencyMs: 175, p95LatencyMs: 250 },
        { stage: 'retrieval', averageLatencyMs: 75, p95LatencyMs: 100 }
      ]
    });
  });

  it('lists traces by tenant and knowledge base without leaking raw metadata', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeObservabilityService({ repo });

    await repo.createTrace(trace({ id: 'trace-kb-1', tenantId: 'tenant-1', knowledgeBaseIds: ['kb-1'] }));
    await repo.createTrace(trace({ id: 'trace-kb-2', tenantId: 'tenant-1', knowledgeBaseIds: ['kb-2'] }));
    await repo.createTrace(trace({ id: 'trace-other-tenant', tenantId: 'tenant-2', knowledgeBaseIds: ['kb-1'] }));
    await repo.createTrace(
      trace({
        id: 'trace-non-rag',
        tenantId: 'tenant-1',
        knowledgeBaseIds: ['kb-1'],
        operation: 'eval.run'
      })
    );

    await expect(service.listTraces({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      items: [
        {
          id: 'trace-kb-1',
          workspaceId: 'tenant-1',
          knowledgeBaseIds: ['kb-1'],
          question: 'How does RAG work?',
          answer: 'Repository projected answer',
          status: 'succeeded',
          latencyMs: 100,
          hitCount: 1,
          citationCount: 1,
          createdBy: 'user-1',
          createdAt: baseTime
        }
      ],
      total: 1,
      page: 1,
      pageSize: 20
    });
    await expect(service.getMetrics({ tenantId: 'tenant-1', knowledgeBaseId: 'kb-1' })).resolves.toMatchObject({
      traceCount: 1,
      questionCount: 1
    });
  });

  it('returns projected trace detail and throws NotFoundException when absent', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeObservabilityService({ repo });
    await repo.createTrace(trace({ id: 'trace-detail' }));

    const detail = await service.getTrace({ tenantId: 'tenant-1', id: 'trace-detail' });
    expect(detail).toMatchObject({
      id: 'trace-detail',
      workspaceId: 'tenant-1',
      question: 'How does RAG work?',
      answer: 'Repository projected answer',
      citations: [
        {
          id: 'cite_chunk-1',
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          title: 'Doc 1',
          quote: 'Chunk preview'
        }
      ],
      retrievalSnapshot: {
        selectedChunks: [
          {
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            title: 'Doc 1',
            contentPreview: 'Chunk preview',
            score: 0.9,
            rank: 1
          }
        ]
      }
    });
    expect(detail.spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'span-trace-detail-retrieval',
          traceId: 'trace-detail',
          stage: 'retrieval',
          name: 'retrieval',
          status: 'succeeded',
          latencyMs: 50
        })
      ])
    );
    await expect(service.getTrace({ tenantId: 'tenant-1', id: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('KnowledgeService observability fallback', () => {
  it('uses repository-backed observability when a repository is available', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repo);
    await repo.createTrace(trace({ id: 'trace-service', tenantId: 'ws_1', knowledgeBaseIds: ['kb-service'] }));

    await expect(service.getObservabilityMetrics({ knowledgeBaseId: 'kb-service' })).resolves.toMatchObject({
      traceCount: 1,
      averageLatencyMs: 100
    });
    await expect(service.listTraces({ knowledgeBaseId: 'kb-service' })).resolves.toMatchObject({
      items: [{ id: 'trace-service', workspaceId: 'ws_1' }],
      total: 1
    });
    await expect(service.getTrace('trace-service')).resolves.toMatchObject({
      id: 'trace-service',
      workspaceId: 'ws_1'
    });
  });

  it('keeps fixture observability when repository and observability service are absent', () => {
    const service = new KnowledgeService();

    const metrics = service.getObservabilityMetrics();
    const traces = service.listTraces();
    const traceDetail = service.getTrace('trace_1');

    expect(metrics.traceCount).toBe(1);
    expect(traces.items[0]?.id).toBe('trace_1');
    expect(traceDetail.id).toBe('trace_1');
  });
});

function trace(input: {
  id: string;
  tenantId?: string;
  knowledgeBaseIds?: string[];
  status?: KnowledgeTraceRecord['status'];
  latencyMs?: number;
  answer?: string;
  errorMessage?: string;
  spans?: KnowledgeTraceRecord['spans'];
  operation?: string;
}): KnowledgeTraceRecord {
  const status = input.status ?? 'succeeded';
  const answerPreview = input.answer ?? 'Repository projected answer';
  return {
    id: input.id,
    tenantId: input.tenantId ?? 'tenant-1',
    operation: input.operation ?? 'rag.chat',
    status,
    knowledgeBaseIds: input.knowledgeBaseIds ?? ['kb-1'],
    conversationId: `conv-${input.id}`,
    messageId: `message-${input.id}`,
    latencyMs: input.latencyMs ?? 100,
    spans: input.spans ?? [
      { id: `span-${input.id}-retrieval`, name: 'retrieval', status, latencyMs: 50 },
      { id: `span-${input.id}-generation`, name: 'generation', status, latencyMs: 125 }
    ],
    metadata: {
      questionPreview: 'How does RAG work?',
      answerPreview,
      createdBy: 'user-1',
      citationSummaries: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          knowledgeBaseId: 'kb-1',
          title: 'Doc 1',
          score: 0.9,
          rank: 1,
          textPreview: 'Chunk preview'
        }
      ],
      rawVendorResponse: { shouldNotLeak: true }
    },
    errorMessage: input.errorMessage,
    createdAt: baseTime,
    updatedAt: baseTime
  };
}
