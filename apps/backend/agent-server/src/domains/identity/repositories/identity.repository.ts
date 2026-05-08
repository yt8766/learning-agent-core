import type { AuthAccount, AuthGlobalRole, AuthUserStatus } from '@agent/core';

export const IDENTITY_REPOSITORY = Symbol('IdentityRepository');

export interface IdentityUserRecord extends AuthAccount {
  passwordHash: string;
}

export interface IdentitySessionRecord {
  id: string;
  userId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface IdentityRefreshTokenRecord {
  id: string;
  sessionId: string;
  tokenHash: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  expiresAt: string;
  replacedByTokenId?: string;
}

export interface CreateIdentityUserInput {
  id: string;
  username: string;
  displayName: string;
  roles: AuthGlobalRole[];
  status: AuthUserStatus;
  passwordHash: string;
}

export interface IdentityRepository {
  createUser(input: CreateIdentityUserInput): Promise<IdentityUserRecord>;
  findUserByUsername(username: string): Promise<IdentityUserRecord | undefined>;
  findUserById(userId: string): Promise<IdentityUserRecord | undefined>;
  listUsers(): Promise<IdentityUserRecord[]>;
  updateUserStatus(userId: string, status: AuthUserStatus): Promise<IdentityUserRecord>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: IdentitySessionRecord): Promise<IdentitySessionRecord>;
  findSession(sessionId: string): Promise<IdentitySessionRecord | undefined>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  createRefreshToken(input: IdentityRefreshTokenRecord): Promise<IdentityRefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<IdentityRefreshTokenRecord | undefined>;
  markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void>;
}
