import { describe, expect, it } from 'vitest';

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
});
