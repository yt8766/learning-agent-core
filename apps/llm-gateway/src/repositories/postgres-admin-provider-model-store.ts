import pg from 'pg';

import type { AdminProviderModelStore, StoredProviderCredential } from '../admin/admin-provider-model-routes';
import type { GatewayModelAdminRecord } from '../contracts/admin-model';
import type { ProviderAdminRecord } from '../contracts/admin-provider';
import type { EncryptedProviderSecretPayload } from '../secrets/provider-secret-vault';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

const { Pool } = pg;

export function createPostgresAdminProviderModelStore(connectionString: string): AdminProviderModelStore {
  return createPostgresAdminProviderModelStoreForClient(new Pool({ connectionString }));
}

export function createPostgresAdminProviderModelStoreForClient(client: PgQueryable): AdminProviderModelStore {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  return {
    async listProviders() {
      await ensureSchema();
      const result = await client.query('select * from providers order by created_at desc');
      return result.rows.map(mapProviderRow);
    },
    async saveProvider(provider) {
      await ensureSchema();
      await client.query(
        `insert into providers (
          id, name, kind, status, base_url, timeout_ms, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update set
          name = excluded.name,
          kind = excluded.kind,
          status = excluded.status,
          base_url = excluded.base_url,
          timeout_ms = excluded.timeout_ms,
          updated_at = excluded.updated_at`,
        [
          provider.id,
          provider.name,
          provider.kind,
          provider.status,
          provider.baseUrl,
          provider.timeoutMs,
          provider.createdAt,
          provider.updatedAt
        ]
      );
      return provider;
    },
    async findProviderById(id) {
      await ensureSchema();
      const result = await client.query('select * from providers where id = $1 limit 1', [id]);
      return result.rows[0] ? mapProviderRow(result.rows[0]) : null;
    },
    async listProviderCredentials(providerId) {
      await ensureSchema();
      const result = await client.query(
        'select * from provider_credentials where provider_id = $1 order by created_at asc',
        [providerId]
      );
      return result.rows.map(mapCredentialRow);
    },
    async saveProviderCredential(credential) {
      await ensureSchema();
      await client.query(
        `insert into provider_credentials (
          id, provider_id, key_prefix, fingerprint, key_version,
          status, encrypted_api_key, created_at, rotated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update set
          status = excluded.status,
          encrypted_api_key = excluded.encrypted_api_key,
          rotated_at = excluded.rotated_at`,
        [
          credential.id,
          credential.providerId,
          credential.keyPrefix,
          credential.fingerprint,
          credential.keyVersion,
          credential.status,
          JSON.stringify(credential.encryptedSecret),
          credential.createdAt,
          credential.rotatedAt
        ]
      );
      return credential;
    },
    async rotateActiveProviderCredentials(providerId, rotatedAt) {
      await ensureSchema();
      await client.query(
        `update provider_credentials
        set status = 'rotated', rotated_at = $2
        where provider_id = $1 and status = 'active'`,
        [providerId, rotatedAt]
      );
    },
    async listModels() {
      await ensureSchema();
      const result = await client.query('select * from gateway_models order by alias asc');
      return result.rows.map(mapModelRow);
    },
    async saveModel(model) {
      await ensureSchema();
      await client.query(
        `insert into gateway_models (
          id, alias, provider_id, provider_model, enabled, context_window,
          input_price_per_1m_tokens, output_price_per_1m_tokens,
          capabilities, fallback_aliases, admin_only, created_at, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        on conflict (id) do update set
          alias = excluded.alias,
          provider_id = excluded.provider_id,
          provider_model = excluded.provider_model,
          enabled = excluded.enabled,
          context_window = excluded.context_window,
          input_price_per_1m_tokens = excluded.input_price_per_1m_tokens,
          output_price_per_1m_tokens = excluded.output_price_per_1m_tokens,
          capabilities = excluded.capabilities,
          fallback_aliases = excluded.fallback_aliases,
          admin_only = excluded.admin_only,
          updated_at = excluded.updated_at`,
        [
          model.id,
          model.alias,
          model.providerId,
          model.providerModel,
          model.enabled,
          model.contextWindow,
          model.inputPricePer1mTokens,
          model.outputPricePer1mTokens,
          model.capabilities,
          model.fallbackAliases,
          model.adminOnly,
          model.createdAt,
          model.updatedAt
        ]
      );
      return model;
    },
    async findModelById(id) {
      await ensureSchema();
      const result = await client.query('select * from gateway_models where id = $1 limit 1', [id]);
      return result.rows[0] ? mapModelRow(result.rows[0]) : null;
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists providers (
      id text primary key,
      name text not null,
      kind text not null,
      status text not null check (status in ('active', 'disabled')),
      base_url text not null,
      timeout_ms integer null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create table if not exists provider_credentials (
      id text primary key,
      provider_id text not null references providers(id) on delete cascade,
      key_prefix text not null,
      fingerprint text not null,
      key_version text not null,
      status text not null check (status in ('active', 'rotated', 'revoked')),
      encrypted_api_key text not null,
      created_at timestamptz not null default now(),
      rotated_at timestamptz null
    )
  `);
  await client.query(`
    create table if not exists gateway_models (
      id text unique,
      alias text primary key,
      provider_id text not null references providers(id),
      provider_model text not null,
      enabled boolean not null default true,
      context_window integer not null,
      input_price_per_1m_tokens numeric null,
      output_price_per_1m_tokens numeric null,
      capabilities text[] not null default array[]::text[],
      fallback_aliases text[] not null default array[]::text[],
      admin_only boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await client.query('alter table gateway_models add column if not exists id text');
  await client.query(
    'alter table gateway_models add column if not exists capabilities text[] not null default array[]::text[]'
  );
  await client.query('create unique index if not exists gateway_models_id_unique on gateway_models(id)');
}

function mapProviderRow(row: Record<string, unknown>): ProviderAdminRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    kind: toProviderKind(row.kind),
    status: row.status === 'disabled' ? 'disabled' : 'active',
    baseUrl: String(row.base_url),
    timeoutMs: toNullableNumber(row.timeout_ms),
    createdAt: row.created_at ? toIsoString(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : new Date().toISOString()
  };
}

function mapCredentialRow(row: Record<string, unknown>): StoredProviderCredential {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    keyPrefix: String(row.key_prefix),
    fingerprint: String(row.fingerprint),
    keyVersion: String(row.key_version),
    status: row.status === 'rotated' || row.status === 'revoked' ? row.status : 'active',
    createdAt: row.created_at ? toIsoString(row.created_at) : new Date().toISOString(),
    rotatedAt: row.rotated_at ? toIsoString(row.rotated_at) : null,
    encryptedSecret: parseEncryptedSecret(row.encrypted_api_key)
  };
}

function mapModelRow(row: Record<string, unknown>): GatewayModelAdminRecord {
  const alias = String(row.alias);

  return {
    id: row.id ? String(row.id) : modelIdForAlias(alias),
    alias,
    providerId: String(row.provider_id),
    providerModel: String(row.provider_model),
    enabled: Boolean(row.enabled),
    contextWindow: Number(row.context_window),
    inputPricePer1mTokens: toNullableNumber(row.input_price_per_1m_tokens),
    outputPricePer1mTokens: toNullableNumber(row.output_price_per_1m_tokens),
    capabilities: toStringArray(row.capabilities) as GatewayModelAdminRecord['capabilities'],
    fallbackAliases: toStringArray(row.fallback_aliases),
    adminOnly: Boolean(row.admin_only),
    createdAt: row.created_at ? toIsoString(row.created_at) : new Date().toISOString(),
    updatedAt: row.updated_at ? toIsoString(row.updated_at) : new Date().toISOString()
  };
}

function parseEncryptedSecret(value: unknown): EncryptedProviderSecretPayload {
  if (typeof value === 'object' && value !== null) {
    return value as EncryptedProviderSecretPayload;
  }

  return JSON.parse(String(value)) as EncryptedProviderSecretPayload;
}

function toProviderKind(value: unknown): ProviderAdminRecord['kind'] {
  const kind = String(value);
  return kind === 'minimax' || kind === 'mimo' || kind === 'mock' || kind === 'openai-compatible' ? kind : 'openai';
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function modelIdForAlias(alias: string): string {
  return `model_${alias.replace(/-/g, '_')}`;
}
