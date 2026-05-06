import { Injectable } from '@nestjs/common';

import type { KnowledgeSqlClient } from './knowledge-sql-client';
import type { KnowledgeSessionRecord, KnowledgeSessionRepository } from './knowledge-session.repository';

interface KnowledgeSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  rotated_to_session_id: string | null;
}

@Injectable()
export class PostgresKnowledgeSessionRepository implements KnowledgeSessionRepository {
  constructor(private readonly client: KnowledgeSqlClient) {}

  async create(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord> {
    return this.queryOne(
      `insert into knowledge_auth_sessions (
         id, user_id, refresh_token_hash, expires_at, revoked_at, rotated_to_session_id, created_at, updated_at
       )
       values ($1,$2,$3,$4,$5,$6,now(),now())
       returning *`,
      [record.id, record.userId, record.refreshTokenHash, record.expiresAt, record.revokedAt, record.rotatedToSessionId]
    );
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<KnowledgeSessionRecord | null> {
    return this.queryOptional(
      `select * from knowledge_auth_sessions
       where refresh_token_hash = $1 and revoked_at is null and expires_at > now()
       limit 1`,
      [refreshTokenHash]
    );
  }

  async findActiveBySessionId(sessionId: string): Promise<KnowledgeSessionRecord | null> {
    return this.queryOptional(
      `select * from knowledge_auth_sessions
       where id = $1 and revoked_at is null and expires_at > now()
       limit 1`,
      [sessionId]
    );
  }

  async rotateActiveSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    newSession: KnowledgeSessionRecord;
    revokedAt: string;
  }): Promise<KnowledgeSessionRecord | null> {
    return this.queryOptional(
      `with revoked_session as (
         update knowledge_auth_sessions
         set revoked_at = $3, rotated_to_session_id = $4, updated_at = $3
         where id = $1 and refresh_token_hash = $2 and revoked_at is null and expires_at > now()
         returning id
       ),
       inserted_session as (
         insert into knowledge_auth_sessions (
           id, user_id, refresh_token_hash, expires_at, revoked_at, rotated_to_session_id, created_at, updated_at
         )
         select $4,$5,$6,$7,$8,$9,now(),now()
         from revoked_session
         returning *
       )
       select * from inserted_session`,
      [
        input.sessionId,
        input.refreshTokenHash,
        input.revokedAt,
        input.newSession.id,
        input.newSession.userId,
        input.newSession.refreshTokenHash,
        input.newSession.expiresAt,
        input.newSession.revokedAt,
        input.newSession.rotatedToSessionId
      ]
    );
  }

  async revoke(input: { sessionId: string; revokedAt: string }): Promise<void> {
    await this.client.query(
      `update knowledge_auth_sessions
       set revoked_at = coalesce(revoked_at, $2),
           updated_at = case when revoked_at is null then $2 else updated_at end
       where id = $1`,
      [input.sessionId, input.revokedAt]
    );
  }

  private async queryOne(sql: string, params: readonly unknown[]): Promise<KnowledgeSessionRecord> {
    const result = await this.client.query<KnowledgeSessionRow>(sql, params);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Knowledge session query did not return a row');
    }
    return mapSessionRow(row);
  }

  private async queryOptional(sql: string, params: readonly unknown[]): Promise<KnowledgeSessionRecord | null> {
    const result = await this.client.query<KnowledgeSessionRow>(sql, params);
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }
}

function mapSessionRow(row: KnowledgeSessionRow): KnowledgeSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: timestampToIsoString(row.expires_at),
    revokedAt: row.revoked_at ? timestampToIsoString(row.revoked_at) : null,
    rotatedToSessionId: row.rotated_to_session_id
  };
}

function timestampToIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
