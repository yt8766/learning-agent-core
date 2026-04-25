import { randomUUID } from 'node:crypto';

import pg from 'pg';

import type { AdminApiKeyStore } from '../admin/admin-api-key-routes';
import type { CreateApiKeyRequest, CreateApiKeyResponse, UpdateApiKeyRequest } from '../contracts/admin-api-key';
import {
  assertApiKeyStatusTransition,
  buildCreateApiKeyResponse,
  normalizeApiKeyModelPermissions,
  type ApiKeyAdminRecordInput
} from '../keys/api-key-admin-service';
import { createVirtualApiKey } from '../keys/api-key';
import { AdminApiKeyRouteError } from '../admin/admin-api-key-routes';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export interface PostgresAdminApiKeyStoreOptions {
  keyHashSecret?: string;
  now?: () => Date;
}

const { Pool } = pg;

export function createPostgresAdminApiKeyStore(
  connectionString: string,
  options: PostgresAdminApiKeyStoreOptions
): AdminApiKeyStore {
  return createPostgresAdminApiKeyStoreForClient(new Pool({ connectionString }), options);
}

export function createPostgresAdminApiKeyStoreForClient(
  client: PgQueryable,
  options: PostgresAdminApiKeyStoreOptions
): AdminApiKeyStore {
  const now = options.now ?? (() => new Date());
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  async function requireExisting(id: string): Promise<ApiKeyAdminRecordInput> {
    const result = await client.query('select * from api_keys where id = $1 limit 1', [id]);
    const row = result.rows[0];
    if (!row) {
      throw new AdminApiKeyRouteError('api_key_not_found', 'API key was not found.', 404);
    }

    return mapApiKeyRow(row);
  }

  return {
    async list() {
      await ensureSchema();
      const result = await client.query('select * from api_keys order by created_at desc');
      return result.rows.map(mapApiKeyRow);
    },
    async create(input: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
      if (!options.keyHashSecret) {
        throw new AdminApiKeyRouteError(
          'api_key_secret_not_configured',
          'Set LLM_GATEWAY_KEY_HASH_SECRET before creating API keys.',
          503
        );
      }

      await ensureSchema();
      const timestamp = now().toISOString();
      const virtualKey = await createVirtualApiKey(options.keyHashSecret);
      const models = normalizeApiKeyModelPermissions(input);
      const record: ApiKeyAdminRecordInput = {
        id: `key_${randomUUID()}`,
        name: input.name,
        keyPrefix: virtualKey.prefix,
        keyHash: virtualKey.hash,
        status: 'active',
        allowAllModels: input.allowAllModels,
        models,
        rpmLimit: input.rpmLimit,
        tpmLimit: input.tpmLimit,
        dailyTokenLimit: input.dailyTokenLimit,
        dailyCostLimit: input.dailyCostLimit,
        usedTokensToday: 0,
        usedCostToday: 0,
        requestCountToday: 0,
        expiresAt: input.expiresAt,
        lastUsedAt: null,
        createdAt: timestamp,
        revokedAt: null
      };

      await client.query(
        `insert into api_keys (
          id, name, key_prefix, key_hash, status, models,
          rpm_limit, tpm_limit, daily_token_limit, daily_cost_limit,
          expires_at, last_used_at, created_at, revoked_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          record.id,
          record.name,
          record.keyPrefix,
          record.keyHash,
          record.status,
          record.models,
          record.rpmLimit,
          record.tpmLimit,
          record.dailyTokenLimit,
          record.dailyCostLimit,
          record.expiresAt,
          record.lastUsedAt,
          record.createdAt,
          record.revokedAt
        ]
      );

      return buildCreateApiKeyResponse({ plaintext: virtualKey.plaintext, record });
    },
    async update(id: string, input: UpdateApiKeyRequest) {
      await ensureSchema();
      const existing = await requireExisting(id);
      if (existing.status === 'revoked') {
        throw new AdminApiKeyRouteError('api_key_revoked_terminal', 'Revoked API keys cannot be updated.', 409);
      }

      const allowAllModels = input.allowAllModels ?? existing.allowAllModels;
      const models = normalizeApiKeyModelPermissions({
        allowAllModels,
        models: input.models ?? existing.models
      });
      const updated = {
        ...existing,
        name: input.name ?? existing.name,
        allowAllModels,
        models,
        rpmLimit: pickPatchValue(input, 'rpmLimit', existing.rpmLimit),
        tpmLimit: pickPatchValue(input, 'tpmLimit', existing.tpmLimit),
        dailyTokenLimit: pickPatchValue(input, 'dailyTokenLimit', existing.dailyTokenLimit),
        dailyCostLimit: pickPatchValue(input, 'dailyCostLimit', existing.dailyCostLimit),
        expiresAt: pickPatchValue(input, 'expiresAt', existing.expiresAt)
      };

      await client.query(
        `update api_keys set
          name = $2,
          models = $3,
          rpm_limit = $4,
          tpm_limit = $5,
          daily_token_limit = $6,
          daily_cost_limit = $7,
          expires_at = $8
        where id = $1`,
        [
          id,
          updated.name,
          updated.models,
          updated.rpmLimit,
          updated.tpmLimit,
          updated.dailyTokenLimit,
          updated.dailyCostLimit,
          updated.expiresAt
        ]
      );

      return updated;
    },
    async revoke(id: string) {
      await ensureSchema();
      const existing = await requireExisting(id);
      assertApiKeyStatusTransition(existing.status, 'revoked');
      if (existing.status === 'revoked') {
        return existing;
      }

      const revoked = {
        ...existing,
        status: 'revoked' as const,
        revokedAt: now().toISOString()
      };
      await client.query('update api_keys set status = $2, revoked_at = $3 where id = $1', [
        id,
        revoked.status,
        revoked.revokedAt
      ]);
      return revoked;
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
}

function mapApiKeyRow(row: Record<string, unknown>): ApiKeyAdminRecordInput {
  const models = toStringArray(row.models);

  return {
    id: String(row.id),
    name: String(row.name),
    keyPrefix: String(row.key_prefix),
    keyHash: String(row.key_hash),
    status: row.status === 'disabled' || row.status === 'revoked' ? row.status : 'active',
    allowAllModels: models.length === 0,
    models,
    rpmLimit: toNullableNumber(row.rpm_limit),
    tpmLimit: toNullableNumber(row.tpm_limit),
    dailyTokenLimit: toNullableNumber(row.daily_token_limit),
    dailyCostLimit: toNullableNumber(row.daily_cost_limit),
    usedTokensToday: Number(row.used_tokens_today ?? 0),
    usedCostToday: Number(row.used_cost_today ?? 0),
    requestCountToday: Number(row.request_count_today ?? 0),
    expiresAt: row.expires_at ? toIsoString(row.expires_at) : null,
    lastUsedAt: row.last_used_at ? toIsoString(row.last_used_at) : null,
    createdAt: row.created_at ? toIsoString(row.created_at) : new Date().toISOString(),
    revokedAt: row.revoked_at ? toIsoString(row.revoked_at) : null
  };
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

function pickPatchValue<Key extends NullableUpdateApiKeyRequestKey>(
  input: UpdateApiKeyRequest,
  key: Key,
  fallback: ApiKeyAdminRecordInput[Key]
): ApiKeyAdminRecordInput[Key] {
  return Object.prototype.hasOwnProperty.call(input, key) ? (input[key] as ApiKeyAdminRecordInput[Key]) : fallback;
}

type NullableUpdateApiKeyRequestKey = 'rpmLimit' | 'tpmLimit' | 'dailyTokenLimit' | 'dailyCostLimit' | 'expiresAt';
