import { describe, expect, it } from 'vitest';

import { createPostgresAdminApiKeyStoreForClient } from '../src/repositories/postgres-admin-api-key-store.js';
import { createPostgresAdminProviderModelStoreForClient } from '../src/repositories/postgres-admin-provider-model-store.js';
import { ProviderSecretVault } from '../src/secrets/provider-secret-vault.js';

type QueryCall = { text: string; values?: unknown[] };

class FakePgClient {
  readonly calls: QueryCall[] = [];
  readonly apiKeys = new Map<string, Record<string, unknown>>();
  readonly providers = new Map<string, Record<string, unknown>>();
  readonly credentials = new Map<string, Record<string, unknown>>();
  readonly models = new Map<string, Record<string, unknown>>();

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text, values });

    if (text.includes('select * from api_keys where id = $1')) {
      const row = this.apiKeys.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select * from api_keys order by created_at desc')) {
      return { rows: Array.from(this.apiKeys.values()) };
    }

    if (text.includes('insert into api_keys')) {
      this.apiKeys.set(String(values?.[0]), {
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
        expires_at: values?.[10],
        last_used_at: values?.[11],
        created_at: values?.[12],
        revoked_at: values?.[13]
      });
      return { rows: [] };
    }

    if (text.includes('update api_keys set') && text.includes('status = $2')) {
      const existing = this.apiKeys.get(String(values?.[0]));
      if (existing) {
        this.apiKeys.set(String(values?.[0]), { ...existing, status: values?.[1], revoked_at: values?.[2] });
      }
      return { rows: [] };
    }

    if (text.includes('update api_keys set')) {
      const existing = this.apiKeys.get(String(values?.[0]));
      if (existing) {
        this.apiKeys.set(String(values?.[0]), {
          ...existing,
          name: values?.[1],
          models: values?.[2],
          rpm_limit: values?.[3],
          tpm_limit: values?.[4],
          daily_token_limit: values?.[5],
          daily_cost_limit: values?.[6],
          expires_at: values?.[7]
        });
      }
      return { rows: [] };
    }

    if (text.includes('select * from providers where id = $1')) {
      const row = this.providers.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select * from providers order by created_at desc')) {
      return { rows: Array.from(this.providers.values()) };
    }

    if (text.includes('insert into providers')) {
      this.providers.set(String(values?.[0]), {
        id: values?.[0],
        name: values?.[1],
        kind: values?.[2],
        status: values?.[3],
        base_url: values?.[4],
        timeout_ms: values?.[5],
        created_at: values?.[6],
        updated_at: values?.[7]
      });
      return { rows: [] };
    }

    if (text.includes('select * from provider_credentials')) {
      return {
        rows: Array.from(this.credentials.values()).filter(row => row.provider_id === values?.[0])
      };
    }

    if (text.includes('insert into provider_credentials')) {
      this.credentials.set(String(values?.[0]), {
        id: values?.[0],
        provider_id: values?.[1],
        key_prefix: values?.[2],
        fingerprint: values?.[3],
        key_version: values?.[4],
        status: values?.[5],
        encrypted_api_key: values?.[6],
        created_at: values?.[7],
        rotated_at: values?.[8]
      });
      return { rows: [] };
    }

    if (text.includes("set status = 'rotated'")) {
      for (const [id, credential] of this.credentials) {
        if (credential.provider_id === values?.[0] && credential.status === 'active') {
          this.credentials.set(id, { ...credential, status: 'rotated', rotated_at: values?.[1] });
        }
      }
      return { rows: [] };
    }

    if (text.includes('select * from gateway_models where id = $1')) {
      const row = this.models.get(String(values?.[0]));
      return { rows: row ? [row] : [] };
    }

    if (text.includes('select * from gateway_models order by alias asc')) {
      return { rows: Array.from(this.models.values()) };
    }

    if (text.includes('insert into gateway_models')) {
      this.models.set(String(values?.[0]), {
        id: values?.[0],
        alias: values?.[1],
        provider_id: values?.[2],
        provider_model: values?.[3],
        enabled: values?.[4],
        context_window: values?.[5],
        input_price_per_1m_tokens: values?.[6],
        output_price_per_1m_tokens: values?.[7],
        capabilities: values?.[8],
        fallback_aliases: values?.[9],
        admin_only: values?.[10],
        created_at: values?.[11],
        updated_at: values?.[12]
      });
      return { rows: [] };
    }

    return { rows: [] };
  }
}

describe('postgres admin route stores', () => {
  it('persists API keys to the same api_keys table used by the gateway runtime', async () => {
    const client = new FakePgClient();
    const store = createPostgresAdminApiKeyStoreForClient(client, {
      keyHashSecret: 'admin-key-store-secret',
      now: () => new Date('2026-04-25T00:00:00.000Z')
    });

    const created = await store.create({
      name: 'Private key',
      allowAllModels: false,
      models: ['gpt-main'],
      rpmLimit: 60,
      tpmLimit: null,
      dailyTokenLimit: null,
      dailyCostLimit: null,
      expiresAt: null
    });
    const [listed] = await store.list();
    const revoked = await store.revoke(created.key.id);

    expect(created.plaintext).toMatch(/^sk-llmgw_/);
    expect(client.apiKeys.get(created.key.id)?.key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(listed).toMatchObject({ id: created.key.id, models: ['gpt-main'], allowAllModels: false });
    expect(revoked).toMatchObject({ id: created.key.id, status: 'revoked' });
    expect(client.calls.some(call => call.text.includes('create table if not exists api_keys'))).toBe(true);
  });

  it('allows listing and revoking API keys without a key hash secret but blocks creation', async () => {
    const client = new FakePgClient();
    const existing = {
      id: 'key_existing',
      name: 'Existing key',
      key_prefix: 'sk-existing',
      key_hash: 'stored-hash',
      status: 'active',
      models: ['gpt-main'],
      rpm_limit: 60,
      tpm_limit: null,
      daily_token_limit: null,
      daily_cost_limit: null,
      expires_at: null,
      last_used_at: null,
      created_at: '2026-04-25T00:00:00.000Z',
      revoked_at: null
    };
    client.apiKeys.set('key_existing', existing);
    const store = createPostgresAdminApiKeyStoreForClient(client, {
      now: () => new Date('2026-04-25T00:00:00.000Z')
    });

    await expect(store.list()).resolves.toEqual([expect.objectContaining({ id: 'key_existing' })]);
    await expect(store.revoke('key_existing')).resolves.toMatchObject({ id: 'key_existing', status: 'revoked' });
    await expect(
      store.create({
        name: 'Blocked key',
        allowAllModels: true,
        models: [],
        rpmLimit: null,
        tpmLimit: null,
        dailyTokenLimit: null,
        dailyCostLimit: null,
        expiresAt: null
      })
    ).rejects.toMatchObject({ code: 'api_key_secret_not_configured', status: 503 });
  });

  it('persists providers, encrypted credentials, and models for admin routes', async () => {
    const client = new FakePgClient();
    const store = createPostgresAdminProviderModelStoreForClient(client);
    const vault = new ProviderSecretVault({
      key: 'provider-store-test-secret-with-32-bytes',
      keyVersion: 'test-v1'
    });
    const encryptedSecret = vault.encrypt('sk-provider-secret');

    await store.saveProvider({
      id: 'provider_openai',
      name: 'OpenAI',
      kind: 'openai',
      status: 'active',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: 30000,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z'
    });
    await store.saveProviderCredential({
      id: 'credential_1',
      providerId: 'provider_openai',
      keyPrefix: 'sk-prov',
      fingerprint: vault.fingerprint('sk-provider-secret'),
      keyVersion: encryptedSecret.keyVersion,
      status: 'active',
      createdAt: '2026-04-25T00:00:00.000Z',
      rotatedAt: null,
      encryptedSecret
    });
    await store.saveModel({
      id: 'model_gpt_main',
      alias: 'gpt-main',
      providerId: 'provider_openai',
      providerModel: 'gpt-4.1',
      enabled: true,
      contextWindow: 128000,
      inputPricePer1mTokens: 2.5,
      outputPricePer1mTokens: null,
      capabilities: ['chat_completions', 'streaming'],
      fallbackAliases: [],
      adminOnly: false,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z'
    });

    await expect(store.findProviderById('provider_openai')).resolves.toMatchObject({ kind: 'openai' });
    await expect(store.listProviderCredentials('provider_openai')).resolves.toEqual([
      expect.objectContaining({
        id: 'credential_1',
        encryptedSecret
      })
    ]);
    await expect(store.findModelById('model_gpt_main')).resolves.toMatchObject({
      alias: 'gpt-main',
      capabilities: ['chat_completions', 'streaming']
    });
    expect(String(client.credentials.get('credential_1')?.encrypted_api_key)).toContain('ciphertext');
    expect(String(client.credentials.get('credential_1')?.encrypted_api_key)).not.toContain('sk-provider-secret');
  });
});
