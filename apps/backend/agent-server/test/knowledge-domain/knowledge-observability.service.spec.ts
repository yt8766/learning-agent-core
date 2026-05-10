import { describe, expect, it } from 'vitest';

import {
  KnowledgeObservabilityMetricsSchema,
  KnowledgePageResultSchema,
  KnowledgeRagTraceDetailSchema,
  KnowledgeRagTraceSchema
} from '@agent/core';
import { KnowledgeObservabilityService } from '../../src/domains/knowledge/services/knowledge-observability.service';

describe('KnowledgeObservabilityService', () => {
  it('returns metrics that parse with KnowledgeObservabilityMetricsSchema', async () => {
    const service = new KnowledgeObservabilityService();
    const metrics = await service.getMetrics();

    expect(() => KnowledgeObservabilityMetricsSchema.parse(metrics)).not.toThrow();
  });

  it('returns a page result that parses with KnowledgePageResultSchema(KnowledgeRagTraceSchema)', async () => {
    const service = new KnowledgeObservabilityService();
    const result = await service.listTraces();

    expect(() => KnowledgePageResultSchema(KnowledgeRagTraceSchema).parse(result)).not.toThrow();
  });

  it('returns an empty page with default pagination', async () => {
    const service = new KnowledgeObservabilityService();
    const result = await service.listTraces();

    expect(result.items).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(0);
  });

  it('returns a trace detail that parses with KnowledgeRagTraceDetailSchema', async () => {
    const service = new KnowledgeObservabilityService();
    const trace = await service.getTrace('test-trace-id');

    expect(() => KnowledgeRagTraceDetailSchema.parse(trace)).not.toThrow();
  });

  it('returns trace detail with the given traceId', async () => {
    const service = new KnowledgeObservabilityService();
    const trace = await service.getTrace('custom-id');

    expect(trace.id).toBe('custom-id');
    expect(trace.status).toBe('succeeded');
    expect(trace.spans).toEqual([]);
    expect(trace.citations).toEqual([]);
  });
});
