import pg from 'pg';

import type { AdminCredential, AdminPrincipal } from '../contracts/admin-auth';
import type { AdminAuthRepository } from './admin-auth';

type PgQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

const { Pool } = pg;

export function createPostgresAdminAuthRepository(connectionString: string): AdminAuthRepository {
  return createPostgresAdminAuthRepositoryForClient(
    new Pool({
      connectionString
    })
  );
}

export function createPostgresAdminAuthRepositoryForClient(client: PgQueryable): AdminAuthRepository {
  let schemaReady: Promise<void> | null = null;

  async function ensureSchema(): Promise<void> {
    schemaReady ??= createSchema(client);
    await schemaReady;
  }

  return {
    async findOwnerPrincipal() {
      await ensureSchema();
      const result = await client.query(
        "select * from admin_principals where role = 'owner' order by created_at asc limit 1"
      );
      return result.rows[0] ? mapPrincipalRow(result.rows[0]) : null;
    },
    async findPrincipalById(id) {
      await ensureSchema();
      const result = await client.query('select * from admin_principals where id = $1 limit 1', [id]);
      return result.rows[0] ? mapPrincipalRow(result.rows[0]) : null;
    },
    async savePrincipal(principal) {
      await ensureSchema();
      await client.query(
        `insert into admin_principals (
          id,
          role,
          display_name,
          status,
          access_token_version,
          refresh_token_version,
          created_at,
          updated_at,
          last_login_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update set
          role = excluded.role,
          display_name = excluded.display_name,
          status = excluded.status,
          access_token_version = excluded.access_token_version,
          refresh_token_version = excluded.refresh_token_version,
          updated_at = excluded.updated_at,
          last_login_at = excluded.last_login_at`,
        [
          principal.id,
          principal.role,
          principal.displayName,
          principal.status,
          principal.accessTokenVersion,
          principal.refreshTokenVersion,
          principal.createdAt,
          principal.updatedAt,
          principal.lastLoginAt
        ]
      );
    },
    async findPasswordCredential(principalId) {
      await ensureSchema();
      const result = await client.query(
        "select * from admin_credentials where principal_id = $1 and kind = 'password' limit 1",
        [principalId]
      );
      return result.rows[0] ? mapCredentialRow(result.rows[0]) : null;
    },
    async saveCredential(credential) {
      await ensureSchema();
      await client.query(
        `insert into admin_credentials (
          id,
          principal_id,
          kind,
          password_hash,
          password_updated_at,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (id) do update set
          principal_id = excluded.principal_id,
          kind = excluded.kind,
          password_hash = excluded.password_hash,
          password_updated_at = excluded.password_updated_at,
          updated_at = excluded.updated_at`,
        [
          credential.id,
          credential.principalId,
          credential.kind,
          credential.passwordHash,
          credential.passwordUpdatedAt,
          credential.createdAt,
          credential.updatedAt
        ]
      );
    }
  };
}

async function createSchema(client: PgQueryable): Promise<void> {
  await client.query(`
    create table if not exists admin_principals (
      id text primary key,
      role text not null check (role = 'owner'),
      display_name text not null,
      status text not null check (status in ('active', 'disabled')),
      access_token_version integer not null,
      refresh_token_version integer not null,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      last_login_at timestamptz null
    )
  `);
  await client.query(`
    create table if not exists admin_credentials (
      id text primary key,
      principal_id text not null references admin_principals(id) on delete cascade,
      kind text not null check (kind = 'password'),
      password_hash text not null,
      password_updated_at timestamptz not null,
      created_at timestamptz not null,
      updated_at timestamptz not null,
      unique (principal_id, kind)
    )
  `);
  await client.query(`
    create table if not exists admin_login_attempts (
      id text primary key,
      principal_hint text null,
      ip_hash text null,
      result text not null,
      created_at timestamptz not null
    )
  `);
  await client.query(`
    create table if not exists admin_audit_events (
      id text primary key,
      actor_principal_id text null,
      type text not null,
      target_type text null,
      target_id text null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null
    )
  `);
}

function mapPrincipalRow(row: Record<string, unknown>): AdminPrincipal {
  return {
    id: String(row.id),
    role: 'owner',
    displayName: String(row.display_name),
    status: row.status === 'disabled' ? 'disabled' : 'active',
    accessTokenVersion: Number(row.access_token_version),
    refreshTokenVersion: Number(row.refresh_token_version),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastLoginAt: row.last_login_at ? toIsoString(row.last_login_at) : null
  };
}

function mapCredentialRow(row: Record<string, unknown>): AdminCredential {
  return {
    id: String(row.id),
    principalId: String(row.principal_id),
    kind: 'password',
    passwordHash: String(row.password_hash),
    passwordUpdatedAt: toIsoString(row.password_updated_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
