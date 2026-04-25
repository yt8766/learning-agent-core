import { randomUUID } from 'node:crypto';

import pg from 'pg';

import type { GatewayModelRecord, GatewayRepository } from '../gateway/gateway-service';
import { verifyVirtualApiKey } from '../keys/api-key';
import type { ProviderSecretVault } from '../secrets/provider-secret-vault';
import {
  mapApiKeyRow,
  mapInvocationLog,
  mapModelRow,
  mapProviderRuntimeConfig,
  mapUsageRecord,
  type PostgresProviderRuntimeConfig
} from './postgres-gateway-mappers';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type PostgresGatewayRepository = GatewayRepository & {
  resolve(alias: string): Promise<GatewayModelRecord | undefined>;
  list(): Promise<GatewayModelRecord[]>;
  listProviderRuntimeConfigs(): Promise<PostgresProviderRuntimeConfig[]>;
};

export interface PostgresGatewayRepositoryOptions {
  keyHashSecret: string;
  providerSecretVault?: ProviderSecretVault;
}

const STORED_PREFIX_LENGTH = 16;
const { Pool } = pg;

export function createPostgresGatewayRepository(
  connectionString: string,
  options: PostgresGatewayRepositoryOptions
): PostgresGatewayRepository {
  return createPostgresGatewayRepositoryForClient(
    new Pool({
      connectionString
    }),
    options
  );
}

export function createPostgresGatewayRepositoryForClient(
  client: PgQueryable,
  options: PostgresGatewayRepositoryOptions
): PostgresGatewayRepository {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  return {
    async verifyApiKey(plaintext) {
      await ensureSchema();
      const prefix = plaintext.slice(0, STORED_PREFIX_LENGTH);
      const result = await client.query('select * from api_keys where key_prefix = $1 limit 1', [prefix]);
      const row = result.rows[0];

      if (!row || !(await verifyVirtualApiKey(plaintext, String(row.key_hash ?? ''), options.keyHashSecret))) {
        return null;
      }

      return mapApiKeyRow(row);
    },
    async getUsageForToday(keyId) {
      await ensureSchema();
      const result = await client.query(
        'select * from daily_usage_rollups where key_id = $1 and usage_date = current_date limit 1',
        [keyId]
      );
      const row = result.rows[0];

      return {
        usedTokensToday: row ? Number(row.used_tokens ?? 0) : 0,
        usedCostToday: row ? Number(row.used_cost ?? 0) : 0
      };
    },
    async writeRequestLog(log) {
      await ensureSchema();
      const mapped = mapInvocationLog(log);
      await client.query(
        `insert into request_logs (
          id,
          key_id,
          requested_model,
          model,
          provider,
          provider_model,
          status,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          estimated_cost,
          usage_source,
          latency_ms,
          stream,
          fallback_attempt_count,
          error_code,
          error_message,
          created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          randomUUID(),
          mapped.keyId,
          mapped.requestedModel,
          mapped.model,
          mapped.provider,
          mapped.providerModel,
          mapped.status,
          mapped.promptTokens,
          mapped.completionTokens,
          mapped.totalTokens,
          mapped.estimatedCost,
          mapped.usageSource,
          mapped.latencyMs,
          mapped.stream,
          mapped.fallbackAttemptCount,
          mapped.errorCode ?? null,
          mapped.errorMessage ?? null,
          new Date().toISOString()
        ]
      );
    },
    async recordUsage(usage) {
      await ensureSchema();
      const mapped = mapUsageRecord(usage);
      await client.query(
        `insert into daily_usage_rollups (
          key_id,
          usage_date,
          used_tokens,
          used_cost,
          updated_at
        ) values ($1, $2, $3, $4, $5)
        on conflict (key_id, usage_date) do update set
          used_tokens = daily_usage_rollups.used_tokens + excluded.used_tokens,
          used_cost = daily_usage_rollups.used_cost + excluded.used_cost,
          updated_at = excluded.updated_at`,
        [mapped.keyId, todayUtc(), mapped.totalTokens, mapped.estimatedCost, new Date().toISOString()]
      );
    },
    async resolve(alias) {
      await ensureSchema();
      const result = await client.query('select * from gateway_models where alias = $1 limit 1', [alias]);
      return result.rows[0] ? mapModelRow(result.rows[0]) : undefined;
    },
    async list() {
      await ensureSchema();
      const result = await client.query('select * from gateway_models order by alias asc');
      return result.rows.map(mapModelRow);
    },
    async listProviderRuntimeConfigs() {
      await ensureSchema();
      const result = await client.query(
        `select
          providers.id as provider_id,
          providers.kind as provider_kind,
          providers.base_url,
          providers.timeout_ms,
          provider_credentials.key_version,
          provider_credentials.encrypted_api_key
        from providers
        join provider_credentials on provider_credentials.provider_id = providers.id
        where providers.status = 'active'
          and provider_credentials.status = 'active'
        order by providers.id asc`
      );

      return result.rows.map(row => mapProviderRuntimeConfig(row, options.providerSecretVault));
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists api_keys (
      id text primary key,
      name text not null,
      key_prefix text not null unique,
      key_hash text not null,
      status text not null check (status in ('active', 'disabled', 'revoked')),
      models text[] not null default array[]::text[],
      rpm_limit integer null,
      tpm_limit integer null,
      daily_token_limit integer null,
      daily_cost_limit numeric null,
      expires_at timestamptz null,
      last_used_at timestamptz null,
      created_at timestamptz not null default now(),
      revoked_at timestamptz null
    )
  `);
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
      alias text primary key,
      provider_id text not null references providers(id),
      provider_model text not null,
      enabled boolean not null default true,
      context_window integer not null,
      input_price_per_1m_tokens numeric null,
      output_price_per_1m_tokens numeric null,
      fallback_aliases text[] not null default array[]::text[],
      admin_only boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create table if not exists request_logs (
      id text primary key,
      key_id text not null references api_keys(id),
      requested_model text not null,
      model text not null,
      provider text not null,
      provider_model text not null,
      status text not null check (status in ('success', 'error')),
      prompt_tokens integer not null,
      completion_tokens integer not null,
      total_tokens integer not null,
      estimated_cost numeric not null,
      usage_source text not null,
      latency_ms integer not null,
      stream boolean not null,
      fallback_attempt_count integer not null,
      error_code text null,
      error_message text null,
      created_at timestamptz not null
    )
  `);
  await client.query(`
    create table if not exists daily_usage_rollups (
      key_id text not null references api_keys(id),
      usage_date date not null,
      used_tokens integer not null default 0,
      used_cost numeric not null default 0,
      updated_at timestamptz not null,
      primary key (key_id, usage_date)
    )
  `);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
