import { describe, expect, it } from 'vitest';

import { RuntimeQuotaService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

describe('runtime quota and usage queue', () => {
  it('denies requests when client token quota is exhausted', () => {
    const quota = new RuntimeQuotaService();
    quota.setPolicy({ subjectType: 'client', subjectId: 'client_1', window: 'monthly', maxTokens: 1, action: 'deny' });
    quota.consume({ subjectType: 'client', subjectId: 'client_1', tokens: 1, requests: 1 });

    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_1', estimatedTokens: 1, estimatedRequests: 1 })
    ).toThrow('Gateway quota exceeded');
  });

  it('denies requests when client request quota is exhausted', () => {
    const quota = new RuntimeQuotaService();
    quota.setPolicy({
      subjectType: 'client',
      subjectId: 'client_1',
      window: 'monthly',
      maxRequests: 1,
      action: 'deny'
    });
    quota.consume({ subjectType: 'client', subjectId: 'client_1', tokens: 0, requests: 1 });

    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_1', estimatedTokens: 0, estimatedRequests: 1 })
    ).toThrow('Gateway quota exceeded');
  });

  it('does not deny warn or fallback quota policies during precheck', () => {
    const quota = new RuntimeQuotaService();
    quota.setPolicy({
      subjectType: 'client',
      subjectId: 'client_warn',
      window: 'monthly',
      maxTokens: 1,
      action: 'warn'
    });
    quota.setPolicy({
      subjectType: 'client',
      subjectId: 'client_fallback',
      window: 'monthly',
      maxTokens: 1,
      action: 'fallback'
    });
    quota.consume({ subjectType: 'client', subjectId: 'client_warn', tokens: 1, requests: 1 });
    quota.consume({ subjectType: 'client', subjectId: 'client_fallback', tokens: 1, requests: 1 });

    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_warn', estimatedTokens: 1, estimatedRequests: 1 })
    ).not.toThrow();
    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_fallback', estimatedTokens: 1, estimatedRequests: 1 })
    ).not.toThrow();
  });

  it('refunds usage without going below zero', () => {
    const quota = new RuntimeQuotaService();
    quota.setPolicy({ subjectType: 'client', subjectId: 'client_1', window: 'monthly', maxTokens: 1, action: 'deny' });
    quota.consume({ subjectType: 'client', subjectId: 'client_1', tokens: 1, requests: 1 });
    quota.refund({ subjectType: 'client', subjectId: 'client_1', tokens: 2, requests: 2 });

    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_1', estimatedTokens: 1, estimatedRequests: 1 })
    ).not.toThrow();
  });

  it('appends and pops usage queue records', () => {
    const queue = new RuntimeUsageQueueService();
    queue.append({
      recordKind: 'runtime-audit',
      requestId: 'inv_1',
      timestamp: '2026-05-10T00:00:00.000Z',
      providerKind: 'codex',
      model: 'gpt-5.4',
      clientId: 'client_1',
      failed: false,
      tokens: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    });

    expect(queue.snapshot()).toEqual({ pending: 1, failed: 0 });
    expect(queue.pop(1)).toHaveLength(1);
    expect(queue.snapshot()).toEqual({ pending: 0, failed: 0 });
    expect(queue.pop(1)).toEqual([]);
  });

  it('appends runtime audit usage records after facade invoke', async () => {
    const quota = new RuntimeQuotaService();
    const queue = new RuntimeUsageQueueService();
    const facade = new RuntimeEngineFacade(quota, queue);

    await facade.invoke(createInvocation());

    await expect(facade.health()).resolves.toMatchObject({
      activeRequests: 0,
      activeStreams: 0,
      usageQueue: { pending: 1, failed: 0 },
      cooldowns: []
    });
    expect(queue.pop(1)).toMatchObject([{ recordKind: 'runtime-audit', requestId: 'inv_1', clientId: 'client_1' }]);
  });

  it('maps runtime quota denial to an OpenAI-compatible 429 error', async () => {
    const quota = new RuntimeQuotaService();
    const facade = new RuntimeEngineFacade(quota, new RuntimeUsageQueueService());
    quota.setPolicy({ subjectType: 'client', subjectId: 'client_1', window: 'monthly', maxTokens: 1, action: 'deny' });
    quota.consume({ subjectType: 'client', subjectId: 'client_1', tokens: 1, requests: 1 });

    await expect(facade.invoke(createInvocation())).rejects.toMatchObject({
      response: { error: { code: 'quota_exceeded', message: 'Gateway quota exceeded', type: 'rate_limit_error' } },
      status: 429
    });
    await expect(facade.health()).resolves.toMatchObject({
      usageQueue: { pending: 0, failed: 0 },
      cooldowns: [
        expect.objectContaining({
          subjectType: 'client',
          subjectId: 'client_1',
          reason: 'quota_exceeded'
        })
      ]
    });
  });
});

function createInvocation() {
  return {
    id: 'inv_1',
    protocol: 'openai.chat.completions' as const,
    model: 'gpt-5.4',
    stream: false,
    messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'ping' }] }],
    requestedAt: '2026-05-10T00:00:00.000Z',
    client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
    metadata: {}
  };
}
