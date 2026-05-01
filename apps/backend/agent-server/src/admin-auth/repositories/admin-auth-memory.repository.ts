import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { AdminAuthRepository } from './admin-auth.repository';
import type {
  AdminAccountRecord,
  AdminAuthAuditEventRecord,
  AdminPasswordCredentialRecord,
  AdminRefreshTokenRecord,
  AdminSessionRecord,
  CreateAdminRefreshTokenInput,
  CreateAdminSessionInput
} from '../interfaces/admin-auth-internal.types';

export type AdminAuthMemoryFixtures = {
  accounts: AdminAccountRecord[];
  credentials: AdminPasswordCredentialRecord[];
};

@Injectable()
export class AdminAuthMemoryRepository extends AdminAuthRepository {
  private readonly accounts = new Map<string, AdminAccountRecord>();
  private readonly credentials = new Map<string, AdminPasswordCredentialRecord>();
  private readonly sessions = new Map<string, AdminSessionRecord>();
  private readonly refreshTokens = new Map<string, AdminRefreshTokenRecord>();
  private readonly auditEvents: AdminAuthAuditEventRecord[] = [];

  constructor(
    fixtures: AdminAuthMemoryFixtures = { accounts: [], credentials: [] },
    private readonly now = () => new Date()
  ) {
    super();
    for (const account of fixtures.accounts) {
      this.accounts.set(account.id, { ...account, roles: [...account.roles] });
    }
    for (const credential of fixtures.credentials) {
      this.credentials.set(credential.accountId, { ...credential });
    }
  }

  async findAccountByUsername(username: string): Promise<AdminAccountRecord | null> {
    return [...this.accounts.values()].find(account => account.username === username) ?? null;
  }

  async findAccountById(accountId: string): Promise<AdminAccountRecord | null> {
    return this.accounts.get(accountId) ?? null;
  }

  async updateAccount(account: AdminAccountRecord): Promise<void> {
    this.accounts.set(account.id, { ...account, roles: [...account.roles] });
  }

  async findPasswordCredentialByAccountId(accountId: string): Promise<AdminPasswordCredentialRecord | null> {
    return this.credentials.get(accountId) ?? null;
  }

  async updatePasswordCredential(credential: AdminPasswordCredentialRecord): Promise<void> {
    this.credentials.set(credential.accountId, { ...credential });
  }

  async createSession(input: CreateAdminSessionInput): Promise<AdminSessionRecord> {
    const session: AdminSessionRecord = {
      id: `admin_sess_${randomUUID()}`,
      accountId: input.accountId,
      status: 'active',
      issuedAt: input.now,
      expiresAt: input.expiresAt,
      createdAt: input.now,
      updatedAt: input.now
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(sessionId: string): Promise<AdminSessionRecord | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(session: AdminSessionRecord): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async revokeSession(sessionId: string, reason: string, now: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === 'revoked') {
      return;
    }
    this.sessions.set(sessionId, {
      ...session,
      status: 'revoked',
      revokedAt: now,
      revokeReason: reason,
      updatedAt: now
    });
  }

  async createRefreshToken(input: CreateAdminRefreshTokenInput): Promise<AdminRefreshTokenRecord> {
    const refreshToken: AdminRefreshTokenRecord = {
      id: `admin_refresh_${randomUUID()}`,
      sessionId: input.sessionId,
      accountId: input.accountId,
      tokenHash: input.tokenHash,
      rotationId: input.rotationId,
      status: 'active',
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      createdAt: input.issuedAt,
      updatedAt: input.issuedAt
    };
    this.refreshTokens.set(refreshToken.id, refreshToken);
    return refreshToken;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AdminRefreshTokenRecord | null> {
    return [...this.refreshTokens.values()].find(token => token.tokenHash === tokenHash) ?? null;
  }

  async markRefreshTokenUsedIfActive(id: string, replacedByTokenId: string, now: string): Promise<boolean> {
    const token = this.refreshTokens.get(id);
    if (!token || token.status !== 'active') {
      return false;
    }
    this.refreshTokens.set(id, {
      ...token,
      status: 'used',
      usedAt: now,
      replacedByTokenId,
      updatedAt: now
    });
    return true;
  }

  async revokeRefreshToken(id: string, now: string): Promise<void> {
    const token = this.refreshTokens.get(id);
    if (!token || token.status === 'revoked') {
      return;
    }
    this.refreshTokens.set(id, {
      ...token,
      status: 'revoked',
      revokedAt: now,
      updatedAt: now
    });
  }

  async revokeActiveRefreshTokensBySessionId(sessionId: string, now: string): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.sessionId === sessionId && token.status === 'active') {
        await this.revokeRefreshToken(token.id, now);
      }
    }
  }

  async appendAuditEvent(input: AdminAuthAuditEventRecord): Promise<void> {
    this.auditEvents.push({ ...input });
  }

  getAuditEvents(): AdminAuthAuditEventRecord[] {
    return [...this.auditEvents];
  }

  getCurrentTime(): Date {
    return this.now();
  }
}
