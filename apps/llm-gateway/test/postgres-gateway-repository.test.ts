import { describe, expect, it } from 'vitest';

import { createVirtualApiKey } from '../src/keys/api-key.js';
import { ProviderSecretVault } from '../src/secrets/provider-secret-vault.js';
import { createPostgresGatewayRepositoryForClient } from '../src/repositories/postgres-gateway-repository.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  apiKeyRow: Record<string, unknown> | null = null;
  modelRows: Record<string, unknown>[] = [];
  providerRows: Record<string, unknown>[] = [];
  usageRow: Record<string, unknown> | null = null;

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('select * from api_keys where key_prefix = $1')) {
      return { rows: this.apiKeyRow && this.apiKeyRow.key_prefix === values?.[0] ? [this.apiKeyRow] : [] };
    }

    if (text.includes('select * from gateway_models where alias = $1')) {
      return { rows: this.modelRows.filter(row => row.alias === values?.[0]) };
    }

    if (text.includes('select * from gateway_models')) {
      return { rows: this.modelRows };
    }

    if (text.includes('select * from daily_usage_rollups')) {
      return { rows: this.usageRow && this.usageRow.key_id === values?.[0] ? [this.usageRow] : [] };
    }

    if (text.includes('providers.id as provider_id')) {
      return { rows: this.providerRows };
    }

    return { rows: [] };
  }
}

describe('postgres gateway repository', () => {
  const providerSecretKey = 'local-provider-secret-vault-key-32';

  it('ensures gateway schema and verifies API keys by plaintext prefix and hash', async () => {
    const client = new FakePgClient();
    const created = await createVirtualApiKey('hash-secret');
    client.apiKeyRow = {
      id: 'key_1',
      name: 'Primary',
      key_prefix: created.prefix,
      key_hash: created.hash,
      status: 'active',
      models: ['gpt-main'],
      rpm_limit: 60,
      tpm_limit: 100000,
      daily_token_limit: 500000,
      daily_cost_limit: '10.5',
      expires_at: null
    };

    const repository = createPostgresGatewayRepositoryForClient(client, { keyHashSecret: 'hash-secret' });

    await expect(repository.verifyApiKey(created.plaintext)).resolves.toMatchObject({
      id: 'key_1',
      name: 'Primary',
      status: 'active',
      models: ['gpt-main'],
      dailyCostLimit: 10.5
    });
    await expect(repository.verifyApiKey('sk-llmgw_wrong')).resolves.toBeNull();
    expect(client.calls.some(call => call.text.includes('create table if not exists api_keys'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists gateway_models'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists providers'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists provider_credentials'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists request_logs'))).toBe(true);
    expect(client.calls.some(call => call.text.includes('create table if not exists daily_usage_rollups'))).toBe(true);
  });

  it('maps model registry reads and persists request logs plus daily rollups', async () => {
    const client = new FakePgClient();
    const vault = new ProviderSecretVault({ key: providerSecretKey, keyVersion: 'local-v1' });
    client.modelRows = [
      {
        alias: 'gpt-main',
        provider_id: 'mock',
        provider_model: 'mock-gpt-main',
        enabled: true,
        context_window: 128000,
        input_price_per_1m_tokens: '1.25',
        output_price_per_1m_tokens: '2.5',
        fallback_aliases: ['cheap-fast'],
        admin_only: false
      }
    ];
    client.usageRow = {
      key_id: 'key_1',
      usage_date: '2026-04-25',
      used_tokens: '15',
      used_cost: '0.025'
    };
    client.providerRows = [
      {
        provider_id: 'provider_openai',
        provider_kind: 'openai',
        base_url: 'https://api.openai.com/v1',
        timeout_ms: 30000,
        key_version: 'local-v1',
        encrypted_api_key: JSON.stringify(vault.encrypt('sk-provider-runtime-secret'))
      }
    ];
    const repository = createPostgresGatewayRepositoryForClient(client, {
      keyHashSecret: 'hash-secret',
      providerSecretVault: vault
    });

    await expect(repository.resolve('gpt-main')).resolves.toMatchObject({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      inputPricePer1mTokens: 1.25,
      outputPricePer1mTokens: 2.5,
      fallbackAliases: ['cheap-fast']
    });
    await expect(repository.list()).resolves.toHaveLength(1);
    await expect(repository.getUsageForToday('key_1')).resolves.toEqual({
      usedTokensToday: 15,
      usedCostToday: 0.025
    });
    await expect(repository.listProviderRuntimeConfigs()).resolves.toEqual([
      {
        providerId: 'provider_openai',
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-provider-runtime-secret',
        timeoutMs: 30000
      }
    ]);

    await repository.writeRequestLog({
      keyId: 'key_1',
      requestedModel: 'gpt-main',
      model: 'cheap-fast',
      providerModel: 'mock-cheap-fast',
      provider: 'mock',
      status: 'success',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.025,
      usageSource: 'provider_final_usage',
      latencyMs: 123,
      stream: false,
      fallbackAttemptCount: 1
    });
    await repository.recordUsage({
      keyId: 'key_1',
      model: 'cheap-fast',
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      estimatedCost: 0.025,
      usageSource: 'provider_final_usage'
    });

    const requestLogInsert = client.calls.find(call => call.text.includes('insert into request_logs'));
    const usageUpsert = client.calls.find(call => call.text.includes('insert into daily_usage_rollups'));
    expect(requestLogInsert?.values).toEqual([
      expect.any(String),
      'key_1',
      'gpt-main',
      'cheap-fast',
      'mock',
      'mock-cheap-fast',
      'success',
      10,
      5,
      15,
      0.025,
      'provider_final_usage',
      123,
      false,
      1,
      null,
      null,
      expect.any(String)
    ]);
    expect(usageUpsert?.values).toEqual(['key_1', expect.any(String), 15, 0.025, expect.any(String)]);
  });

  it('decrypts provider runtime configs before exposing adapter credentials', async () => {
    const client = new FakePgClient();
    const vault = new ProviderSecretVault({ key: providerSecretKey, keyVersion: 'local-v1' });
    client.providerRows = [
      {
        provider_id: 'provider_openai',
        provider_kind: 'openai',
        base_url: 'https://api.openai.com/v1',
        timeout_ms: 30000,
        key_version: 'local-v1',
        encrypted_api_key: JSON.stringify(vault.encrypt('sk-provider-runtime-secret'))
      }
    ];
    const repository = createPostgresGatewayRepositoryForClient(client, {
      keyHashSecret: 'hash-secret',
      providerSecretVault: vault
    });

    await expect(repository.listProviderRuntimeConfigs()).resolves.toEqual([
      {
        providerId: 'provider_openai',
        providerKind: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-provider-runtime-secret',
        timeoutMs: 30000
      }
    ]);
  });

  it('fails closed when provider runtime configs are requested without a provider secret vault', async () => {
    const client = new FakePgClient();
    const vault = new ProviderSecretVault({ key: providerSecretKey, keyVersion: 'local-v1' });
    client.providerRows = [
      {
        provider_id: 'provider_openai',
        provider_kind: 'openai',
        base_url: 'https://api.openai.com/v1',
        timeout_ms: 30000,
        key_version: 'local-v1',
        encrypted_api_key: JSON.stringify(vault.encrypt('sk-provider-runtime-secret'))
      }
    ];
    const repository = createPostgresGatewayRepositoryForClient(client, { keyHashSecret: 'hash-secret' });

    await expect(repository.listProviderRuntimeConfigs()).rejects.toMatchObject({
      name: 'GatewayError',
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Provider secret vault is required for Postgres provider runtime credentials.'
    });
  });

  it('fails closed when provider credential key version cannot be decrypted by the configured vault', async () => {
    const client = new FakePgClient();
    const writerVault = new ProviderSecretVault({ key: providerSecretKey, keyVersion: 'local-v1' });
    const runtimeVault = new ProviderSecretVault({ key: providerSecretKey, keyVersion: 'local-v2' });
    client.providerRows = [
      {
        provider_id: 'provider_openai',
        provider_kind: 'openai',
        base_url: 'https://api.openai.com/v1',
        timeout_ms: 30000,
        key_version: 'local-v1',
        encrypted_api_key: JSON.stringify(writerVault.encrypt('sk-provider-runtime-secret'))
      }
    ];
    const repository = createPostgresGatewayRepositoryForClient(client, {
      keyHashSecret: 'hash-secret',
      providerSecretVault: runtimeVault
    });

    await expect(repository.listProviderRuntimeConfigs()).rejects.toMatchObject({
      name: 'GatewayError',
      code: 'UPSTREAM_UNAVAILABLE',
      message: 'Provider credential for provider_openai could not be decrypted.'
    });
  });
});
