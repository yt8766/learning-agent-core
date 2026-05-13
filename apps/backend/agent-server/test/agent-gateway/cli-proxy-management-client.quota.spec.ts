import { describe, expect, it, vi } from 'vitest';

import { refreshCliProxyQuotaDetails } from '../../src/domains/agent-gateway/management/cli-proxy-management-client.quota';

describe('cli-proxy-management-client.quota', () => {
  function createMockCall(body: unknown) {
    return vi.fn(async () => ({
      ok: true,
      statusCode: 200,
      header: {},
      bodyText: JSON.stringify(body),
      body,
      durationMs: 1
    }));
  }

  it('maps quota details from top-level items', async () => {
    const call = createMockCall({
      items: [
        {
          providerId: 'gemini',
          model: 'gemini-pro',
          scope: 'model',
          window: 'daily',
          limit: 1000,
          used: 300,
          remaining: 700,
          resetAt: '2026-05-12T00:00:00.000Z',
          refreshedAt: '2026-05-11T00:00:00.000Z',
          status: 'normal'
        }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].providerId).toBe('gemini');
    expect(result.items[0].status).toBe('normal');
  });

  it('maps quota details from nested body.body', async () => {
    const call = createMockCall({
      body: {
        items: [
          {
            provider_id: 'claude',
            model_id: 'claude-opus',
            scope: 'model',
            period: '24h',
            limit_tokens: 5000,
            used_tokens: 2000,
            remaining_tokens: 3000,
            reset_at: '2026-05-12T00:00:00.000Z',
            refreshed_at: '2026-05-11T00:00:00.000Z',
            status: 'warning'
          }
        ]
      }
    });

    const result = await refreshCliProxyQuotaDetails('claude', call);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].providerId).toBe('claude');
    expect(result.items[0].window).toBe('24h');
  });

  it('uses providerKind fallback when providerId is missing', async () => {
    const call = createMockCall({
      items: [
        {
          model: 'test-model',
          scope: 'provider',
          window: 'daily',
          limit: 100
        }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('custom', call);
    expect(result.items[0].providerId).toBe('custom');
  });

  it('uses authFileId as model fallback', async () => {
    const call = createMockCall({
      items: [
        {
          providerId: 'gemini',
          authFileId: 'gemini-auth.json',
          window: 'daily',
          limit: 100
        }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].model).toBe('gemini-auth.json');
  });

  it('uses providerId as model fallback when both authFileId and model missing', async () => {
    const call = createMockCall({
      items: [
        {
          providerId: 'gemini',
          window: 'daily',
          limit: 100
        }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].model).toBe('gemini');
  });

  it('uses default scope based on authFileId presence', async () => {
    const callWithAuth = createMockCall({
      items: [{ providerId: 'gemini', authFileId: 'af-1', model: 'm', window: 'daily', limit: 100 }]
    });
    const resultWithAuth = await refreshCliProxyQuotaDetails('gemini', callWithAuth);
    expect(resultWithAuth.items[0].scope).toBe('model');

    const callWithoutAuth = createMockCall({
      items: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 100 }]
    });
    const resultWithoutAuth = await refreshCliProxyQuotaDetails('gemini', callWithoutAuth);
    expect(resultWithoutAuth.items[0].scope).toBe('provider');
  });

  it('calculates remaining from limit - used when remaining not provided', async () => {
    const call = createMockCall({
      items: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 1000, used: 300 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].remaining).toBe(700);
  });

  it('clamps negative values to 0', async () => {
    const call = createMockCall({
      items: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: -100, used: -50, remaining: -10 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].limit).toBe(0);
    expect(result.items[0].used).toBe(0);
    expect(result.items[0].remaining).toBe(0);
  });

  it('normalizes quota status values', async () => {
    const call = createMockCall({
      items: [
        { providerId: 'a', model: 'm', window: 'd', limit: 10, status: 'normal' },
        { providerId: 'b', model: 'm', window: 'd', limit: 10, status: 'warning' },
        { providerId: 'c', model: 'm', window: 'd', limit: 10, status: 'exceeded' },
        { providerId: 'd', model: 'm', window: 'd', limit: 10, status: 'unknown' },
        { providerId: 'e', model: 'm', window: 'd', limit: 10 }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].status).toBe('normal');
    expect(result.items[1].status).toBe('warning');
    expect(result.items[2].status).toBe('exceeded');
    expect(result.items[3].status).toBe('warning');
    expect(result.items[4].status).toBe('warning');
  });

  it('builds composite id from parts', async () => {
    const call = createMockCall({
      items: [{ providerId: 'gemini', authFileId: 'af-1', model: 'm', window: 'daily', limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].id).toBe('gemini:af-1:m:daily');
  });

  it('builds id from providerId:model:window when authFileId missing', async () => {
    const call = createMockCall({
      items: [{ limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    // providerId defaults to providerKind='gemini', model defaults to providerId='gemini', window defaults to 'unknown'
    expect(result.items[0].id).toBe('gemini:gemini:unknown');
  });

  it('uses alternative field names', async () => {
    const call = createMockCall({
      items: [
        {
          provider_kind: 'gemini',
          auth_file_id: 'af-1',
          model_id: 'gemini-pro',
          scope: 'model',
          period: '24h',
          limit_tokens: 5000,
          used_tokens: 2000,
          remaining_tokens: 3000,
          reset_at: '2026-05-12T00:00:00.000Z',
          refreshed_at: '2026-05-11T00:00:00.000Z'
        }
      ]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items[0].providerId).toBe('gemini');
    expect(result.items[0].limit).toBe(5000);
    expect(result.items[0].used).toBe(2000);
    expect(result.items[0].resetAt).toBe('2026-05-12T00:00:00.000Z');
  });

  it('maps from quotas key', async () => {
    const call = createMockCall({
      quotas: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items).toHaveLength(1);
  });

  it('maps from quotaDetails key', async () => {
    const call = createMockCall({
      quotaDetails: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items).toHaveLength(1);
  });

  it('maps from quota_details key', async () => {
    const call = createMockCall({
      quota_details: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items).toHaveLength(1);
  });

  it('maps from records key', async () => {
    const call = createMockCall({
      records: [{ providerId: 'gemini', model: 'm', window: 'daily', limit: 100 }]
    });

    const result = await refreshCliProxyQuotaDetails('gemini', call);
    expect(result.items).toHaveLength(1);
  });
});
