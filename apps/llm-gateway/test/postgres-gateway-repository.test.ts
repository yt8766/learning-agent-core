import { describe, expect, it } from 'vitest';

import { createPostgresGatewayRepositoryForClient } from '../src/repositories/postgres-gateway.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  readonly apiKeys = new Map<string, Record<string, unknown>>();
  readonly models = new Map<string, Record<string, unknown>>();
  readonly usageRows: Record<string, { used_tokens_today: number; used_cost_today: number }> = {};
  readonly logs: unknown[] = [];
  readonly usageRecords: unknown[] = [];

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('select * from gateway_api_keys where key_prefix = $1')) {
      const row = this.apiKeys.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select coalesce(sum(total_tokens)')) {
      return { rows: [this.usageRows[String(values?.[0])] ?? { used_tokens_today: 0, used_cost_today: 0 }] };
    }

    if (text.includes('select * from gateway_models where alias = $1')) {
      const row = this.models.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select * from gateway_models order by alias asc')) {
      return { rows: [...this.models.values()] };
    }

    if (text.includes('insert into gateway_api_keys')) {
      this.apiKeys.set(String(values?.[2]), {
        id: values?.[0],
        name: values?.[1],
        key_prefix: values?.[2],
        key_hash: values?.[3],
        status: values?.[4],
        models: values?.[5],
        rpm_limit: values?.[6],
        tpm_limit: values?.[7],
        daily_token_limit: values?.[8],
        daily_cost_limit: values?.[9],
        expires_at: values?.[10]
      });
      return { rows: [] };
    }

    if (text.includes('insert into gateway_models')) {
      this.models.set(String(values?.[0]), {
        alias: values?.[0],
        provider: values?.[1],
        provider_model: values?.[2],
        enabled: values?.[3],
        context_window: values?.[4],
        input_price_per_1m_tokens: values?.[5],
        output_price_per_1m_tokens: values?.[6],
        fallback_aliases: values?.[7],
        admin_only: values?.[8]
      });
      return { rows: [] };
    }

    if (text.includes('insert into gateway_usage')) {
      this.usageRecords.push(values);
      return { rows: [] };
    }

    if (text.includes('insert into gateway_request_logs')) {
      this.logs.push(values);
      return { rows: [] };
    }

    return { rows: [] };
  }
}

const secret = 'e2e-test-secret';
const plaintext = 'sk-llmgw_test_valid_000000000000';
const prefix = plaintext.slice(0, 16);

describe('postgres gateway repository', () => {
  it('maps key, model, usage, and log records through the gateway repository contract', async () => {
    const client = new FakePgClient();
    const repository = createPostgresGatewayRepositoryForClient(client, { apiKeySecret: secret });

    await repository.saveSeedApiKey({
      id: 'key-valid',
      name: 'E2E valid key',
      plaintext,
      status: 'active',
      models: ['gpt-main'],
      rpmLimit: 10,
      tpmLimit: 1000,
      dailyTokenLimit: 10000,
      dailyCostLimit: 1,
      expiresAt: null
    });

    client.models.set('gpt-main', {
      alias: 'gpt-main',
      provider: 'mock',
      provider_model: 'mock-gpt-main',
      enabled: true,
      context_window: 128000,
      input_price_per_1m_tokens: 0,
      output_price_per_1m_tokens: 0,
      fallback_aliases: [],
      admin_only: false
    });
    client.usageRows['key-valid'] = { used_tokens_today: 12, used_cost_today: 0.001 };

    await expect(repository.verifyApiKey(plaintext)).resolves.toMatchObject({
      id: 'key-valid',
      status: 'active',
      models: ['gpt-main'],
      usedTokensToday: 0
    });
    await expect(repository.getUsageForToday('key-valid')).resolves.toEqual({
      usedTokensToday: 12,
      usedCostToday: 0.001
    });
    await expect(repository.findModelByAlias('gpt-main')).resolves.toMatchObject({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      enabled: true
    });

    await repository.recordUsage({
      keyId: 'key-valid',
      model: 'gpt-main',
      promptTokens: 5,
      completionTokens: 7,
      totalTokens: 12,
      estimatedCost: 0.001
    });
    await repository.writeRequestLog({ keyId: 'key-valid', model: 'gpt-main', status: 'success' });

    expect(client.calls.some(call => call.text.includes('create table if not exists gateway_api_keys'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists gateway_models'))).toBe(true);
    expect(client.usageRecords).toHaveLength(1);
    expect(client.logs).toHaveLength(1);
    expect(client.apiKeys.get(prefix)?.key_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
