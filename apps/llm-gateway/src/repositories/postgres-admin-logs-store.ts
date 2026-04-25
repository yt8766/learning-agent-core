import pg from 'pg';

import { buildDashboard, redactLogEntry, type AdminLogsStore } from '../admin/admin-logs-routes';
import type { AdminRequestLogEntry, AdminRequestLogQuery } from '../contracts/admin-logs';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

const { Pool } = pg;

export function createPostgresAdminLogsStore(connectionString: string): AdminLogsStore {
  return createPostgresAdminLogsStoreForClient(new Pool({ connectionString }));
}

export function createPostgresAdminLogsStoreForClient(client: PgQueryable): AdminLogsStore {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  return {
    async list(query) {
      await ensureSchema();
      const rows = await queryRequestLogs(client, query);
      return {
        items: rows.map(row => redactLogEntry(mapRequestLogRow(row))),
        nextCursor: null
      };
    },
    async dashboard(query) {
      await ensureSchema();
      const rows = await queryRequestLogs(client, query);
      return buildDashboard(rows.map(mapRequestLogRow).map(redactLogEntry));
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists request_logs (
      id text primary key,
      key_id text not null,
      requested_model text not null,
      model text not null,
      provider text not null,
      provider_model text not null,
      status text not null,
      prompt_tokens integer not null default 0,
      completion_tokens integer not null default 0,
      total_tokens integer not null default 0,
      estimated_cost numeric not null default 0,
      usage_source text not null default 'estimated',
      latency_ms integer not null default 0,
      stream boolean not null default false,
      fallback_attempt_count integer not null default 0,
      error_code text,
      error_message text,
      created_at timestamptz not null default now()
    )
  `);
}

async function queryRequestLogs(client: PgQueryable, query: AdminRequestLogQuery) {
  const clauses: string[] = [];
  const values: unknown[] = [];

  addFilter(clauses, values, 'key_id', query.keyId);
  addFilter(clauses, values, 'model', query.model);
  addFilter(clauses, values, 'provider', query.provider);
  addFilter(clauses, values, 'status', query.status);

  const whereClause = clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '';
  values.push(query.limit);

  const result = await client.query(
    `select * from request_logs${whereClause} order by created_at desc limit $${values.length}`,
    values
  );
  return result.rows;
}

function addFilter(clauses: string[], values: unknown[], column: string, value: string | undefined): void {
  if (!value) {
    return;
  }

  values.push(value);
  clauses.push(`${column} = $${values.length}`);
}

function mapRequestLogRow(row: Record<string, unknown>): AdminRequestLogEntry {
  return {
    id: String(row.id),
    keyId: String(row.key_id),
    requestedModel: String(row.requested_model),
    model: String(row.model),
    provider: String(row.provider),
    providerModel: String(row.provider_model),
    status: row.status === 'error' ? 'error' : 'success',
    promptTokens: Number(row.prompt_tokens ?? 0),
    completionTokens: Number(row.completion_tokens ?? 0),
    totalTokens: Number(row.total_tokens ?? 0),
    estimatedCost: Number(row.estimated_cost ?? 0),
    latencyMs: Number(row.latency_ms ?? 0),
    stream: Boolean(row.stream),
    fallbackAttemptCount: Number(row.fallback_attempt_count ?? 0),
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: toIsoString(row.created_at)
  };
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}
