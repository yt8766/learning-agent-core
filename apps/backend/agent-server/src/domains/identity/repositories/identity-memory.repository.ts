import { Injectable } from '@nestjs/common';
import type { AuthUserStatus } from '@agent/core';

import type {
  CreateIdentityUserInput,
  IdentityRefreshTokenRecord,
  IdentityRepository,
  IdentitySessionRecord,
  IdentityUserRecord
} from './identity.repository';

@Injectable()
export class IdentityMemoryRepository implements IdentityRepository {
  private readonly users = new Map<string, IdentityUserRecord>();
  private readonly sessions = new Map<string, IdentitySessionRecord>();
  private readonly refreshTokensByHash = new Map<string, IdentityRefreshTokenRecord>();

  async createUser(input: CreateIdentityUserInput): Promise<IdentityUserRecord> {
    const record: IdentityUserRecord = { ...input };
    this.users.set(record.id, record);
    return record;
  }

  async findUserByUsername(username: string): Promise<IdentityUserRecord | undefined> {
    return [...this.users.values()].find(user => user.username === username);
  }

  async findUserById(userId: string): Promise<IdentityUserRecord | undefined> {
    return this.users.get(userId);
  }

  async listUsers(): Promise<IdentityUserRecord[]> {
    return [...this.users.values()];
  }

  async updateUserStatus(userId: string, status: AuthUserStatus): Promise<IdentityUserRecord> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`Identity user not found: ${userId}`);
    }
    const updated = { ...existing, status };
    this.users.set(userId, updated);
    return updated;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) {
      throw new Error(`Identity user not found: ${userId}`);
    }
    this.users.set(userId, { ...existing, passwordHash });
  }

  async createSession(input: IdentitySessionRecord): Promise<IdentitySessionRecord> {
    this.sessions.set(input.id, input);
    return input;
  }

  async findSession(sessionId: string): Promise<IdentitySessionRecord | undefined> {
    return this.sessions.get(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.sessions.set(sessionId, { ...existing, status: 'revoked' });
    }
  }

  async createRefreshToken(input: IdentityRefreshTokenRecord): Promise<IdentityRefreshTokenRecord> {
    this.refreshTokensByHash.set(input.tokenHash, input);
    return input;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<IdentityRefreshTokenRecord | undefined> {
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
