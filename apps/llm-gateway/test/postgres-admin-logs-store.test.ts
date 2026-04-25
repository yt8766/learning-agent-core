import { describe, expect, it } from 'vitest';

import { createPostgresAdminLogsStoreForClient } from '../src/repositories/postgres-admin-logs-store.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  readonly logs = [
    {
      id: 'log_1',
      key_id: 'key_prod',
      requested_model: 'gpt-main',
      model: 'gpt-main',
      provider: 'openai',
      provider_model: 'gpt-4.1',
      status: 'success',
      prompt_tokens: 30,
      completion_tokens: 70,
      total_tokens: 100,
      estimated_cost: '0.002',
      usage_source: 'provider',
      latency_ms: 200,
      stream: false,
      fallback_attempt_count: 0,
      error_code: null,
      error_message: null,
      created_at: '2026-04-25T00:00:00.000Z'
    },
    {
      id: 'log_2',
      key_id: 'key_stage',
      requested_model: 'gpt-alt',
      model: 'gpt-alt',
      provider: 'minimax',
      provider_model: 'abab6.5',
      status: 'error',
      prompt_tokens: 20,
      completion_tokens: 0,
      total_tokens: 20,
      estimated_cost: '0.001',
      usage_source: 'estimated',
      latency_ms: 800,
      stream: true,
      fallback_attempt_count: 1,
      error_code: 'provider_error',
      error_message: 'upstream failed with sk-provider-secret',
      created_at: '2026-04-25T00:01:00.000Z'
    }
  ];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('from request_logs')) {
      const filtered = this.logs.filter(row => {
        if (values?.includes('key_stage') && row.key_id !== 'key_stage') return false;
        if (values?.includes('gpt-alt') && row.model !== 'gpt-alt') return false;
        if (values?.includes('minimax') && row.provider !== 'minimax') return false;
        if (values?.includes('error') && row.status !== 'error') return false;
        return true;
      });
      return { rows: filtered };
    }

    return { rows: [] };
  }
}

describe('postgres admin logs store', () => {
  it('queries request_logs with operational filters and redacts error messages', async () => {
    const client = new FakePgClient();
    const store = createPostgresAdminLogsStoreForClient(client);

    const result = await store.list({
      keyId: 'key_stage',
      model: 'gpt-alt',
      provider: 'minimax',
      status: 'error',
      limit: 25
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'log_2',
      keyId: 'key_stage',
      model: 'gpt-alt',
      provider: 'minimax',
      status: 'error',
      errorMessage: '[redacted]'
    });
    expect(JSON.stringify(result)).not.toContain('sk-provider-secret');
    expect(client.calls.some(call => call.text.includes('create table if not exists request_logs'))).toBe(true);
    const selectCall = client.calls.find(call => call.text.includes('from request_logs'));
    expect(selectCall?.text).toContain('where key_id = $1 and model = $2 and provider = $3 and status = $4');
    expect(selectCall?.values).toEqual(['key_stage', 'gpt-alt', 'minimax', 'error', 25]);
  });

  it('builds dashboard rollups from filtered request logs', async () => {
    const store = createPostgresAdminLogsStoreForClient(new FakePgClient());

    const dashboard = await store.dashboard({ provider: 'minimax', limit: 50 });

    expect(dashboard.summary).toEqual({
      requestCount: 1,
      totalTokens: 20,
      estimatedCost: 0.001,
      failureRate: 1,
      averageLatencyMs: 800
    });
    expect(dashboard.topModels).toEqual([{ model: 'gpt-alt', requestCount: 1, totalTokens: 20, estimatedCost: 0.001 }]);
    expect(dashboard.topKeys[0].keyId).toBe('key_stage');
    expect(dashboard.topProviders[0].provider).toBe('minimax');
  });
});
