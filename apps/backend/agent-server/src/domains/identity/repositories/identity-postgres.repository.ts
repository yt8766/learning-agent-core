import type { AuthGlobalRole, AuthUserStatus } from '@agent/core';

import type {
  CreateIdentityUserInput,
  IdentityRefreshTokenRecord,
  IdentityRepository,
  IdentitySessionRecord,
  IdentityUserRecord
} from './identity.repository';

export interface PostgresIdentityClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export class IdentityPostgresRepository implements IdentityRepository {
  constructor(private readonly client: PostgresIdentityClient) {}

  async createUser(input: CreateIdentityUserInput): Promise<IdentityUserRecord> {
    const result = await this.client.query(
      `with inserted_user as (
         insert into identity_users (id, username, display_name, global_roles, status)
         values ($1, $2, $3, $4, $5)
         returning id, username, display_name, global_roles, status
       ),
       inserted_credentials as (
         insert into identity_password_credentials (user_id, password_hash)
         select id, $6 from inserted_user
         returning user_id, password_hash
       )
       select u.id, u.username, u.display_name, u.global_roles, u.status, c.password_hash
       from inserted_user u
       join inserted_credentials c on c.user_id = u.id`,
      [input.id, input.username, input.displayName, input.roles, input.status, input.passwordHash]
    );
    return mapUser(requiredRow(result.rows[0], 'identity user'));
  }

  async findUserByUsername(username: string): Promise<IdentityUserRecord | undefined> {
    const result = await this.client.query(
      `select u.id, u.username, u.display_name, u.global_roles, u.status, c.password_hash
       from identity_users u
       join identity_password_credentials c on c.user_id = u.id
       where u.username = $1
       limit 1`,
      [username]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async findUserById(userId: string): Promise<IdentityUserRecord | undefined> {
    const result = await this.client.query(
      `select u.id, u.username, u.display_name, u.global_roles, u.status, c.password_hash
       from identity_users u
       join identity_password_credentials c on c.user_id = u.id
       where u.id = $1
       limit 1`,
      [userId]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  }

  async listUsers(): Promise<IdentityUserRecord[]> {
    const result = await this.client.query(
      `select u.id, u.username, u.display_name, u.global_roles, u.status, c.password_hash
       from identity_users u
       join identity_password_credentials c on c.user_id = u.id
       order by u.username`
    );
    return result.rows.map(mapUser);
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<IdentityUserRecord> {
    const result = await this.client.query(
      `with updated_user as (
         update identity_users
         set status = $2, updated_at = now()
         where id = $1
         returning id, username, display_name, global_roles, status
       )
       select u.id, u.username, u.display_name, u.global_roles, u.status, c.password_hash
       from updated_user u
       join identity_password_credentials c on c.user_id = u.id`,
      [userId, status]
    );
    return mapUser(requiredRow(result.rows[0], 'identity user'));
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.client.query(
      `update identity_password_credentials
       set password_hash = $2, updated_at = now()
       where user_id = $1`,
      [userId, passwordHash]
    );
  }

  async createSession(input: IdentitySessionRecord): Promise<IdentitySessionRecord> {
    await this.client.query(
      `insert into identity_refresh_sessions (id, user_id, status, expires_at)
       values ($1, $2, $3, $4)`,
      [input.id, input.userId, input.status, input.expiresAt]
    );
    return input;
  }

  async findSession(sessionId: string): Promise<IdentitySessionRecord | undefined> {
    const result = await this.client.query(
      `select id, user_id, status, expires_at
       from identity_refresh_sessions
       where id = $1
       limit 1`,
      [sessionId]
    );
    return result.rows[0] ? mapSession(result.rows[0]) : undefined;
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.client.query(
      `update identity_refresh_sessions
       set status = 'revoked', revoked_at = now(), revocation_reason = $2
       where id = $1`,
      [sessionId, reason]
    );
  }

  async createRefreshToken(input: IdentityRefreshTokenRecord): Promise<IdentityRefreshTokenRecord> {
    await this.client.query(
      `insert into identity_refresh_tokens (id, session_id, token_hash, status, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [input.id, input.sessionId, input.tokenHash, input.status, input.expiresAt]
    );
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<IdentityRefreshTokenRecord | undefined> {
    const result = await this.client.query(
      `select id, session_id, token_hash, status, expires_at, replaced_by_token_id
       from identity_refresh_tokens
       where token_hash = $1
       limit 1`,
      [tokenHash]
    );
    return result.rows[0] ? mapRefreshToken(result.rows[0]) : undefined;
  }

  async markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void> {
    await this.client.query(
      `update identity_refresh_tokens
       set status = 'used', used_at = now(), replaced_by_token_id = $2
       where id = $1`,
      [tokenId, replacedByTokenId]
    );
  }
}

function mapUser(row: Record<string, unknown>): IdentityUserRecord {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    roles: mapRoles(row.global_roles),
    status: row.status as AuthUserStatus,
    passwordHash: String(row.password_hash)
  };
}

function mapSession(row: Record<string, unknown>): IdentitySessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as IdentitySessionRecord['status'],
    expiresAt: toIsoString(row.expires_at)
  };
}

function mapRefreshToken(row: Record<string, unknown>): IdentityRefreshTokenRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    tokenHash: String(row.token_hash),
    status: row.status as IdentityRefreshTokenRecord['status'],
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
