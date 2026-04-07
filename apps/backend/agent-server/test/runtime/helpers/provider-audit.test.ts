import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchProviderUsageAudit,
  fetchProviderUsageAuditFromAdapter,
  normalizeProviderAuditResponse,
  summarizeProviderBilling,
  type ProviderAuditAdapterConfig
} from '../../../src/runtime/helpers/provider-audit';

describe('provider-audit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes array and object payloads into daily buckets', () => {
    const records = normalizeProviderAuditResponse({
      records: [
        {
          day: '2026-04-01',
          prompt_tokens: 100,
          completion_tokens: 40,
          cost_usd: 1.234,
          count: 2
        },
        {
          billingDate: '2026-04-01',
          input_tokens: 50,
          output_tokens: 10,
          total_cost_cny: 3.335,
          requestCount: 1
        },
        {
          date: '2026-04-02',
          totalTokens: 90,
          costUsd: 0.45,
          runs: 3
        },
        null,
        {
          date: ''
        }
      ]
    });

    expect(records).toEqual([
      {
        day: '2026-04-01',
        promptTokens: 150,
        completionTokens: 50,
        totalTokens: 200,
        costUsd: 1.23,
        costCny: 12.22,
        runs: 3
      },
      {
        day: '2026-04-02',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 90,
        costUsd: 0.45,
        costCny: 3.24,
        runs: 3
      }
    ]);
  });

  it('returns synced/configured/error results from a provider adapter fetch', async () => {
    const adapter: ProviderAuditAdapterConfig = {
      provider: 'openai',
      endpoint: 'https://audit.example.com/provider',
      apiKey: 'secret',
      source: 'primary'
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          items: [
            { day: '2026-03-31', promptTokens: 10, completionTokens: 5, costUsd: 0.2, runs: 1 },
            { day: '2026-04-01', promptTokens: 20, completionTokens: 10, costUsd: 0.4, runs: 2 }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ items: [] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503
      })
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const synced = await fetchProviderUsageAuditFromAdapter(adapter, 1);
    const configured = await fetchProviderUsageAuditFromAdapter(adapter, 2);
    const failedStatus = await fetchProviderUsageAuditFromAdapter(adapter, 2);
    const failedError = await fetchProviderUsageAuditFromAdapter(adapter, 2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://audit.example.com/provider?days=1',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret'
        }
      })
    );
    expect(synced).toEqual(
      expect.objectContaining({
        status: 'synced',
        provider: 'openai',
        source: 'primary',
        daily: [
          expect.objectContaining({
            day: '2026-04-01',
            totalTokens: 30
          })
        ]
      })
    );
    expect(configured).toEqual(
      expect.objectContaining({
        status: 'configured',
        message: 'provider audit endpoint 已配置，但当前未返回可用记录',
        daily: []
      })
    );
    expect(failedStatus).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'provider audit request failed: 503'
      })
    );
    expect(failedError).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'network down'
      })
    );
  });

  it('prioritizes the primary provider and falls back across adapters', async () => {
    const adapters: ProviderAuditAdapterConfig[] = [
      {
        provider: 'secondary',
        endpoint: 'https://audit.example.com/secondary',
        apiKey: '',
        source: 'secondary'
      },
      {
        provider: 'primary',
        endpoint: 'https://audit.example.com/primary',
        apiKey: '',
        source: 'primary'
      }
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ day: '2026-04-01', total_tokens: 99, amount: 7.2, count: 4 }]
        })
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchProviderUsageAudit(adapters, 'primary', 7);

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://audit.example.com/primary?days=7', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://audit.example.com/secondary?days=7', expect.any(Object));
    expect(result).toEqual(
      expect.objectContaining({
        status: 'synced',
        provider: 'secondary',
        source: 'secondary',
        daily: [expect.objectContaining({ totalTokens: 99, costCny: 7.2, runs: 4 })]
      })
    );
  });

  it('returns disabled when no adapters are configured and summarizes billing totals', async () => {
    const result = await fetchProviderUsageAudit([], 'glm', 7);

    expect(result).toEqual({
      status: 'disabled',
      provider: 'glm',
      source: 'unconfigured',
      message: '未配置 provider usage audit adapter',
      daily: []
    });
    expect(
      summarizeProviderBilling([
        {
          day: '2026-04-01',
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          costUsd: 1.235,
          costCny: 8.885,
          runs: 2
        },
        {
          day: '2026-04-02',
          promptTokens: 5,
          completionTokens: 7,
          totalTokens: 12,
          costUsd: 0.2,
          costCny: 1.1,
          runs: 1
        }
      ])
    ).toEqual({
      promptTokens: 15,
      completionTokens: 27,
      totalTokens: 42,
      costUsd: 1.44,
      costCny: 9.99,
      runs: 3
    });
  });

  it('handles non-array payloads, clamps days, omits auth header, and falls back unknown errors', async () => {
    expect(normalizeProviderAuditResponse({ items: 'invalid' })).toEqual([]);
    expect(normalizeProviderAuditResponse('invalid')).toEqual([]);

    const adapter: ProviderAuditAdapterConfig = {
      provider: 'glm',
      endpoint: 'https://audit.example.com/provider',
      apiKey: '',
      source: 'fallback'
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          records: [{ day: '2026-04-02', total_tokens: 10, cost_usd: 0.1 }]
        })
      })
      .mockRejectedValueOnce('unexpected');
    vi.stubGlobal('fetch', fetchMock);

    const synced = await fetchProviderUsageAuditFromAdapter(adapter, 0);
    const failed = await fetchProviderUsageAuditFromAdapter(adapter, -2);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://audit.example.com/provider?days=1',
      expect.objectContaining({
        headers: {
          Accept: 'application/json'
        }
      })
    );
    expect(synced).toEqual(
      expect.objectContaining({
        status: 'synced',
        provider: 'glm',
        source: 'fallback',
        daily: [expect.objectContaining({ day: '2026-04-02', totalTokens: 10 })]
      })
    );
    expect(failed).toEqual(
      expect.objectContaining({
        status: 'error',
        message: 'unknown provider audit error'
      })
    );
  });
});
