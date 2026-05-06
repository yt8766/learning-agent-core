import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeSqlClient } from '../../src/knowledge/repositories/knowledge-sql-client';
import type { KnowledgeSessionRecord } from '../../src/knowledge/repositories/knowledge-session.repository';
import { PostgresKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-postgres-session.repository';

describe('PostgresKnowledgeSessionRepository', () => {
  it('creates and finds active refresh token sessions by hash and id', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);

    await repository.create(sessionRecord());

    await expect(repository.findActiveByRefreshTokenHash('hash-1')).resolves.toEqual(sessionRecord());
    await expect(repository.findActiveBySessionId('session-1')).resolves.toEqual(sessionRecord());
    expect(client.activeSelectSql).toEqual(
      expect.arrayContaining([
        expect.stringContaining('revoked_at is null'),
        expect.stringContaining('expires_at > now()')
      ])
    );
  });

  it('does not return revoked sessions from active lookups', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);

    await repository.create(sessionRecord({ revokedAt: '2026-05-01T10:00:00.000Z' }));

    await expect(repository.findActiveByRefreshTokenHash('hash-1')).resolves.toBeNull();
    await expect(repository.findActiveBySessionId('session-1')).resolves.toBeNull();
  });

  it('maps postgres date values to ISO strings for active session lookups', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);

    client.seedRow({
      id: 'session-date',
      user_id: 'user-1',
      refresh_token_hash: 'hash-date',
      expires_at: new Date('2026-05-08T00:00:00.000Z'),
      revoked_at: null,
      rotated_to_session_id: null
    });

    await expect(repository.findActiveByRefreshTokenHash('hash-date')).resolves.toEqual(
      sessionRecord({
        id: 'session-date',
        refreshTokenHash: 'hash-date',
        expiresAt: '2026-05-08T00:00:00.000Z'
      })
    );
  });

  it('rotates an active session by revoking the old row and saving the new row', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);
    const newSession = sessionRecord({ id: 'session-2', refreshTokenHash: 'hash-2' });

    await repository.create(sessionRecord());

    await expect(
      repository.rotateActiveSession({
        sessionId: 'session-1',
        refreshTokenHash: 'hash-1',
        newSession,
        revokedAt: '2026-05-01T10:00:00.000Z'
      })
    ).resolves.toEqual(newSession);

    expect(client.row('session-1')).toMatchObject({
      revoked_at: '2026-05-01T10:00:00.000Z',
      rotated_to_session_id: 'session-2'
    });
    expect(client.row('session-2')).toMatchObject({ id: 'session-2', refresh_token_hash: 'hash-2' });
  });

  it('does not save the new session when rotation refresh hash does not match', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);

    await repository.create(sessionRecord());

    await expect(
      repository.rotateActiveSession({
        sessionId: 'session-1',
        refreshTokenHash: 'wrong-hash',
        newSession: sessionRecord({ id: 'session-2', refreshTokenHash: 'hash-2' }),
        revokedAt: '2026-05-01T10:00:00.000Z'
      })
    ).resolves.toBeNull();

    expect(client.row('session-1')).toMatchObject({ revoked_at: null, rotated_to_session_id: null });
    expect(client.row('session-2')).toBeUndefined();
  });

  it('revokes sessions idempotently', async () => {
    const client = new FakeKnowledgeSessionSqlClient();
    const repository = new PostgresKnowledgeSessionRepository(client);

    await repository.create(sessionRecord());
    await repository.revoke({ sessionId: 'session-1', revokedAt: '2026-05-01T10:00:00.000Z' });
    await repository.revoke({ sessionId: 'session-1', revokedAt: '2026-05-01T11:00:00.000Z' });
    await repository.revoke({ sessionId: 'missing-session', revokedAt: '2026-05-01T12:00:00.000Z' });

    expect(client.row('session-1')).toMatchObject({ revoked_at: '2026-05-01T10:00:00.000Z' });
  });
});

interface KnowledgeSessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  expires_at: string | Date;
  revoked_at: string | Date | null;
  rotated_to_session_id: string | null;
}

class FakeKnowledgeSessionSqlClient implements KnowledgeSqlClient {
  readonly query = vi.fn(async (sql: string, params: readonly unknown[] = []) => this.route(sql, params));
  readonly activeSelectSql: string[] = [];

  private readonly rows: KnowledgeSessionRow[] = [];

  row(sessionId: string): KnowledgeSessionRow | undefined {
    return this.rows.find(row => row.id === sessionId);
  }

  seedRow(row: KnowledgeSessionRow): void {
    this.rows.push(row);
  }

  private route(sql: string, params: readonly unknown[]) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (normalized.includes('select * from knowledge_auth_sessions') && normalized.includes('refresh_token_hash')) {
      expect(normalized).toContain('revoked_at is null');
      expect(normalized).toContain('expires_at > now()');
      this.activeSelectSql.push(normalized);
      return { rows: this.rows.filter(row => row.refresh_token_hash === params[0] && isActive(row)) };
    }
    if (normalized.includes('select * from knowledge_auth_sessions') && normalized.includes('id = $1')) {
      expect(normalized).toContain('revoked_at is null');
      expect(normalized).toContain('expires_at > now()');
      this.activeSelectSql.push(normalized);
      return { rows: this.rows.filter(row => row.id === params[0] && isActive(row)) };
    }
    if (normalized.startsWith('with revoked_session as')) {
      expect(normalized).toContain('revoked_at is null');
      expect(normalized).toContain('expires_at > now()');
      const oldRow = this.rows.find(
        row => row.id === params[0] && row.refresh_token_hash === params[1] && isActive(row)
      );
      if (!oldRow) {
        return { rows: [] };
      }
      oldRow.revoked_at = params[2] as string;
      oldRow.rotated_to_session_id = params[3] as string;
      const newRow = this.insertRow(params.slice(3));
      this.rows.push(newRow);
      return { rows: [newRow] };
    }
    if (normalized.includes('insert into knowledge_auth_sessions')) {
      const row = this.insertRow(params);
      this.rows.push(row);
      return { rows: [row] };
    }
    if (normalized.includes('update knowledge_auth_sessions')) {
      const row = this.rows.find(item => item.id === params[0]);
      if (row && row.revoked_at === null) {
        row.revoked_at = params[1] as string;
      }
      return { rows: [] };
    }
    return { rows: [] };
  }

  private insertRow(params: readonly unknown[]): KnowledgeSessionRow {
    return {
      id: params[0] as string,
      user_id: params[1] as string,
      refresh_token_hash: params[2] as string,
      expires_at: params[3] as string,
      revoked_at: (params[4] as string | null | undefined) ?? null,
      rotated_to_session_id: (params[5] as string | null | undefined) ?? null
    };
  }
}

function sessionRecord(overrides: Partial<KnowledgeSessionRecord> = {}): KnowledgeSessionRecord {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'hash-1',
    expiresAt: '2026-05-08T00:00:00.000Z',
    revokedAt: null,
    rotatedToSessionId: null,
    ...overrides
  };
}

function isActive(row: KnowledgeSessionRow): boolean {
  return row.revoked_at === null && timestampOf(row.expires_at) > Date.parse('2026-05-01T00:00:00.000Z');
}

function timestampOf(value: string | Date): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}
