import { Injectable } from '@nestjs/common';
import type { AuthUserStatus } from '@agent/core';

import type {
  AuthRefreshTokenRecord,
  AuthRepository,
  AuthSessionRecord,
  AuthUserRecord,
  CreateAuthUserInput
} from './auth.repository';

@Injectable()
export class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, AuthSessionRecord>();
  private readonly refreshTokensByHash = new Map<string, AuthRefreshTokenRecord>();

  async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const record: AuthUserRecord = { ...input };
    this.users.set(record.id, record);
    return record;
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | undefined> {
    return [...this.users.values()].find(user => user.username === username);
  }

  async findUserById(userId: string): Promise<AuthUserRecord | undefined> {
    return this.users.get(userId);
  }

  async listUsers(): Promise<AuthUserRecord[]> {
    return [...this.users.values()];
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`User not found: ${userId}`);
    }
    const updated = { ...existing, status };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`User not found: ${userId}`);
    }
    this.users.set(userId, { ...existing, passwordHash });
  }

  async createSession(input: AuthSessionRecord): Promise<AuthSessionRecord> {
    this.sessions.set(input.id, input);
    return input;
  }

  async findSession(sessionId: string): Promise<AuthSessionRecord | undefined> {
    return this.sessions.get(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.sessions.set(sessionId, { ...existing, status: 'revoked' });
    }
  }

  async createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord> {
    this.refreshTokensByHash.set(input.tokenHash, input);
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined> {
    return this.refreshTokensByHash.get(tokenHash);
  }

  async markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void> {
    for (const [hash, token] of this.refreshTokensByHash.entries()) {
      if (token.id === tokenId) {
        this.refreshTokensByHash.set(hash, { ...token, status: 'used', replacedByTokenId });
        return;
      }
    }
  }
}
