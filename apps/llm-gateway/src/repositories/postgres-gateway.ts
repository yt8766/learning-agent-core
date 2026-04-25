import pg from 'pg';

import type { KeyStatus } from '../contracts';
import type { GatewayKeyRecord, GatewayModelRecord, GatewayRepository } from '../gateway/gateway-service';
import { createVirtualApiKeyForPlaintext, verifyVirtualApiKey } from '../keys/api-key';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

const { Pool } = pg;

export interface PostgresGatewayRepositoryOptions {
  apiKeySecret: string;
}

export interface SeedApiKeyInput {
  id: string;
  name: string;
  plaintext: string;
  status: KeyStatus;
  models: string[];
  rpmLimit: number | null;
  tpmLimit: number | null;
  dailyTokenLimit: number | null;
  dailyCostLimit: number | null;
  expiresAt: string | null;
}

export type PostgresGatewayRepository = GatewayRepository & {
  listModels(): Promise<GatewayModelRecord[]>;
  findModelByAlias(alias: string): Promise<GatewayModelRecord | undefined>;
  saveModel(model: GatewayModelRecord): Promise<void>;
  saveSeedApiKey(input: SeedApiKeyInput): Promise<void>;
};

export function createPostgresGatewayRepository(
  connectionString: string,
  options: PostgresGatewayRepositoryOptions
): PostgresGatewayRepository {
  return createPostgresGatewayRepositoryForClient(new Pool({ connectionString }), options);
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
      const prefix = plaintext.slice(0, 16);
      const result = await client.query('select * from gateway_api_keys where key_prefix = $1 limit 1', [prefix]);
      const row = result.rows[0];

      if (!row) {
        return null;
      }

      const valid = await verifyVirtualApiKey(plaintext, String(row.key_hash), options.apiKeySecret);
      return valid ? mapKeyRow(row) : null;
    },
    async getUsageForToday(keyId) {
      await ensureSchema();
      const result = await client.query(
        `select coalesce(sum(total_tokens), 0)::int as used_tokens_today,
          coalesce(sum(estimated_cost), 0)::float as used_cost_today
        from gateway_usage
        where key_id = $1 and created_at >= date_trunc('day', now())`,
        [keyId]
      );
      const row = result.rows[0] ?? {};
      return {
        usedTokensToday: Number(row.used_tokens_today ?? 0),
        usedCostToday: Number(row.used_cost_today ?? 0)
      };
    },
    async recordUsage(usage) {
      await ensureSchema();
      const value = usage as Record<string, unknown>;
      await client.query(
        `insert into gateway_usage (
          id, key_id, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now())`,
        [
          `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          value.keyId,
          value.model,
          value.promptTokens,
          value.completionTokens,
          value.totalTokens,
          value.estimatedCost
        ]
      );
    },
    async writeRequestLog(log) {
      await ensureSchema();
      await client.query('insert into gateway_request_logs (id, payload, created_at) values ($1, $2, now())', [
        `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        JSON.stringify(log)
      ]);
    },
    async listModels() {
      await ensureSchema();
      const result = await client.query('select * from gateway_models order by alias asc');
      return result.rows.map(mapModelRow);
    },
    async findModelByAlias(alias) {
      await ensureSchema();
      const result = await client.query('select * from gateway_models where alias = $1 limit 1', [alias]);
      return result.rows[0] ? mapModelRow(result.rows[0]) : undefined;
    },
    async saveModel(model) {
      await ensureSchema();
      await client.query(
        `insert into gateway_models (
          alias, provider, provider_model, enabled, context_window,
          input_price_per_1m_tokens, output_price_per_1m_tokens, fallback_aliases, admin_only
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (alias) do update set
          provider = excluded.provider,
          provider_model = excluded.provider_model,
          enabled = excluded.enabled,
          context_window = excluded.context_window,
          input_price_per_1m_tokens = excluded.input_price_per_1m_tokens,
          output_price_per_1m_tokens = excluded.output_price_per_1m_tokens,
          fallback_aliases = excluded.fallback_aliases,
          admin_only = excluded.admin_only`,
        [
          model.alias,
          model.provider,
          model.providerModel,
          model.enabled,
          model.contextWindow ?? null,
          model.inputPricePer1mTokens ?? null,
          model.outputPricePer1mTokens ?? null,
          model.fallbackAliases ?? [],
          model.adminOnly ?? false
        ]
      );
    },
    async saveSeedApiKey(input) {
      await ensureSchema();
      const created = createVirtualApiKeyForPlaintext(input.plaintext, options.apiKeySecret);
      await client.query(
        `insert into gateway_api_keys (
          id, name, key_prefix, key_hash, status, models, rpm_limit, tpm_limit,
          daily_token_limit, daily_cost_limit, expires_at, created_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        on conflict (id) do update set
          name = excluded.name,
          key_prefix = excluded.key_prefix,
          key_hash = excluded.key_hash,
          status = excluded.status,
          models = excluded.models,
          rpm_limit = excluded.rpm_limit,
          tpm_limit = excluded.tpm_limit,
          daily_token_limit = excluded.daily_token_limit,
          daily_cost_limit = excluded.daily_cost_limit,
          expires_at = excluded.expires_at`,
        [
          input.id,
          input.name,
          created.prefix,
          created.hash,
          input.status,
          input.models,
          input.rpmLimit,
          input.tpmLimit,
          input.dailyTokenLimit,
          input.dailyCostLimit,
          input.expiresAt
        ]
      );
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists gateway_api_keys (
      id text primary key,
      name text not null,
      key_prefix text not null unique,
      key_hash text not null,
      status text not null check (status in ('active', 'disabled', 'revoked')),
      models text[] not null,
      rpm_limit integer null,
      tpm_limit integer null,
      daily_token_limit integer null,
      daily_cost_limit double precision null,
      expires_at timestamptz null,
      created_at timestamptz not null,
      revoked_at timestamptz null
    )
  `);
  await client.query(`
    create table if not exists gateway_models (
      alias text primary key,
      provider text not null,
      provider_model text not null,
      enabled boolean not null,
      context_window integer null,
      input_price_per_1m_tokens double precision null,
      output_price_per_1m_tokens double precision null,
      fallback_aliases text[] not null default '{}',
      admin_only boolean not null default false
    )
  `);
  await client.query(`
    create table if not exists gateway_usage (
      id text primary key,
      key_id text not null,
      model text not null,
      prompt_tokens integer not null,
      completion_tokens integer not null,
      total_tokens integer not null,
      estimated_cost double precision not null,
      created_at timestamptz not null
    )
  `);
  await client.query(`
    create table if not exists gateway_request_logs (
      id text primary key,
      payload jsonb not null,
      created_at timestamptz not null
    )
  `);
}

function mapKeyRow(row: Record<string, unknown>): GatewayKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status === 'disabled' ? 'disabled' : row.status === 'revoked' ? 'revoked' : 'active',
    models: Array.isArray(row.models) ? row.models.map(String) : [],
    rpmLimit: nullableNumber(row.rpm_limit),
    tpmLimit: nullableNumber(row.tpm_limit),
    dailyTokenLimit: nullableNumber(row.daily_token_limit),
    dailyCostLimit: nullableNumber(row.daily_cost_limit),
    usedTokensToday: 0,
    usedCostToday: 0,
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null
  };
}

function mapModelRow(row: Record<string, unknown>): GatewayModelRecord {
  return {
    alias: String(row.alias),
    provider: String(row.provider),
    providerModel: String(row.provider_model),
    enabled: row.enabled === true,
    contextWindow: nullableNumber(row.context_window) ?? undefined,
    inputPricePer1mTokens: nullableNumber(row.input_price_per_1m_tokens),
    outputPricePer1mTokens: nullableNumber(row.output_price_per_1m_tokens),
    fallbackAliases: Array.isArray(row.fallback_aliases) ? row.fallback_aliases.map(String) : [],
    adminOnly: row.admin_only === true
  };
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
