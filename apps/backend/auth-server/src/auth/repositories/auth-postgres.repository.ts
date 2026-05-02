import type { AuthGlobalRole, AuthUserStatus } from '@agent/core';

import type {
  AuthRefreshTokenRecord,
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthUserInput
} from './auth.repository';

interface PgClientLike {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly client: PgClientLike) {}

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const result = await this.client.query(
      `insert into auth_users (id, username, display_name, global_roles, status, password_hash)
       values ($1, $2, $3, $4, $5, $6)
       returning id, username, display_name, global_roles, status, password_hash`,
      [input.id, input.username, input.displayName, input.roles, input.status, input.passwordHash]
    );
    return mapUser(requiredRow(result.rows[0], 'auth user'));
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | undefined> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash
       from auth_users
       where username = $1
       limit 1`,
      [username]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash
       from auth_users
       where id = $1
       limit 1`,
      [userId]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    const result = await this.client.query(
      `select id, username, display_name, global_roles, status, password_hash
       from auth_users
       order by username`
    );
    return result.rows.map(mapUser);
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord> {
    const result = await this.client.query(
      `update auth_users
       set status = $2, updated_at = now()
       where id = $1
       returning id, username, display_name, global_roles, status, password_hash`,
      [userId, status]
    );
    return mapUser(requiredRow(result.rows[0], 'auth user'));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.client.query(
      `update auth_users
       set password_hash = $2, updated_at = now()
       where id = $1`,
      [userId, passwordHash]
    );
  }

  async createSession(input: AuthSessionRecord): Promise<AuthSessionRecord> {
    await this.client.query(
      `insert into auth_sessions (id, user_id, status, expires_at)
       values ($1, $2, $3, $4)`,
      [input.id, input.userId, input.status, input.expiresAt]
    );
    return input;
  }

  async findSession(sessionId: string): Promise<AuthSessionRecord | undefined> {
    const result = await this.client.query(
      `select id, user_id, status, expires_at
       from auth_sessions
       where id = $1
       limit 1`,
      [sessionId]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.client.query(
      `update auth_sessions
       set status = 'revoked', revoked_at = now(), revocation_reason = $2
       where id = $1`,
      [sessionId, reason]
    );
  }

  async createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord> {
    await this.client.query(
      `insert into auth_refresh_tokens (id, session_id, token_hash, status, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [input.id, input.sessionId, input.tokenHash, input.status, input.expiresAt]
    );
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined> {
    const result = await this.client.query(
      `select id, session_id, token_hash, status, expires_at, replaced_by_token_id
       from auth_refresh_tokens
       where token_hash = $1
       limit 1`,
      [tokenHash]
    );
    return result.rows[0] ? mapRefreshToken(result.rows[0]) : undefined;
  }

  async markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void> {
    await this.client.query(
      `update auth_refresh_tokens
       set status = 'used', used_at = now(), replaced_by_token_id = $2
       where id = $1`,
      [tokenId, replacedByTokenId]
    );
  }
}

function mapUser(row: Record<string, unknown>): AuthUserRecord {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    roles: mapRoles(row.global_roles),
    status: row.status as AuthUserStatus,
    passwordHash: String(row.password_hash)
  };
}

function mapSession(row: Record<string, unknown>): AuthSessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as AuthSessionRecord['status'],
    expiresAt: toIsoString(row.expires_at)
  };
}

function mapRefreshToken(row: Record<string, unknown>): AuthRefreshTokenRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    tokenHash: String(row.token_hash),
    status: row.status as AuthRefreshTokenRecord['status'],
    expiresAt: toIsoString(row.expires_at),
    replacedByTokenId: row.replaced_by_token_id ? String(row.replaced_by_token_id) : undefined
  };
}

function mapRoles(value: unknown): AuthGlobalRole[] {
  if (Array.isArray(value)) {
    return value.map(role => String(role) as AuthGlobalRole);
  }
  return String(value)
    .replace(/^{|}$/g, '')
    .split(',')
    .filter(Boolean)
    .map(role => role.trim() as AuthGlobalRole);
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

function requiredRow(row: Record<string, unknown> | undefined, name: string): Record<string, unknown> {
  if (!row) {
    throw new Error(`Missing ${name} row`);
  }
  return row;
}
