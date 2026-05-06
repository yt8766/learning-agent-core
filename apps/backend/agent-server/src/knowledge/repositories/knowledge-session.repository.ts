import { Injectable } from '@nestjs/common';

export const KNOWLEDGE_SESSION_REPOSITORY = Symbol('KNOWLEDGE_SESSION_REPOSITORY');

export interface KnowledgeSessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedToSessionId: string | null;
}

export interface KnowledgeSessionRepository {
  create(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord>;
  findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<KnowledgeSessionRecord | null>;
  findActiveBySessionId(sessionId: string): Promise<KnowledgeSessionRecord | null>;
  rotateActiveSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    newSession: KnowledgeSessionRecord;
    revokedAt: string;
  }): Promise<KnowledgeSessionRecord | null>;
  revoke(input: { sessionId: string; revokedAt: string }): Promise<void>;
}

@Injectable()
export class InMemoryKnowledgeSessionRepository implements KnowledgeSessionRepository {
  private readonly sessions = new Map<string, KnowledgeSessionRecord>();
  private readonly sessionIdsByRefreshTokenHash = new Map<string, string>();

  async create(record: KnowledgeSessionRecord): Promise<KnowledgeSessionRecord> {
    const stored = { ...record };
    this.sessions.set(stored.id, stored);
    this.sessionIdsByRefreshTokenHash.set(stored.refreshTokenHash, stored.id);
    return { ...stored };
  }

  async findActiveByRefreshTokenHash(refreshTokenHash: string): Promise<KnowledgeSessionRecord | null> {
    const sessionId = this.sessionIdsByRefreshTokenHash.get(refreshTokenHash);
    if (!sessionId) {
      return null;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt) {
      return null;
    }

    return { ...session };
  }

  async findActiveBySessionId(sessionId: string): Promise<KnowledgeSessionRecord | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt) {
      return null;
    }

    return { ...session };
  }

  async rotateActiveSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    newSession: KnowledgeSessionRecord;
    revokedAt: string;
  }): Promise<KnowledgeSessionRecord | null> {
    const session = this.sessions.get(input.sessionId);
    if (!session || session.revokedAt || session.refreshTokenHash !== input.refreshTokenHash) {
      return null;
    }

    this.sessions.set(input.sessionId, {
      ...session,
      revokedAt: input.revokedAt,
      rotatedToSessionId: input.newSession.id
    });
    this.sessions.set(input.newSession.id, { ...input.newSession });
    this.sessionIdsByRefreshTokenHash.set(input.newSession.refreshTokenHash, input.newSession.id);

    return { ...input.newSession };
  }

  async revoke(input: { sessionId: string; revokedAt: string }): Promise<void> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      return;
    }

    this.sessions.set(input.sessionId, {
      ...session,
      revokedAt: input.revokedAt
    });
  }
}
