import type { AuthAccount, AuthGlobalRole, AuthUserStatus } from '@agent/core';

export interface AuthUserRecord extends AuthAccount {
  passwordHash: string;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
}

export interface AuthRefreshTokenRecord {
  id: string;
  sessionId: string;
  tokenHash: string;
  status: 'active' | 'used' | 'revoked' | 'expired';
  expiresAt: string;
  replacedByTokenId?: string;
}

export interface CreateAuthUserInput {
  id: string;
  username: string;
  displayName: string;
  roles: AuthGlobalRole[];
  status: AuthUserStatus;
  passwordHash: string;
}

export interface AuthRepository {
  createUser(input: CreateAuthUserInput): Promise<AuthUserRecord>;
  findUserByUsername(username: string): Promise<AuthUserRecord | undefined>;
  findUserById(userId: string): Promise<AuthUserRecord | undefined>;
  listUsers(): Promise<AuthUserRecord[]>;
  updateUserStatus(userId: string, status: AuthUserStatus): Promise<AuthUserRecord>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  createSession(input: AuthSessionRecord): Promise<AuthSessionRecord>;
  findSession(sessionId: string): Promise<AuthSessionRecord | undefined>;
  revokeSession(sessionId: string, reason: string): Promise<void>;
  createRefreshToken(input: AuthRefreshTokenRecord): Promise<AuthRefreshTokenRecord>;
  findRefreshTokenByHash(tokenHash: string): Promise<AuthRefreshTokenRecord | undefined>;
  markRefreshTokenUsed(tokenId: string, replacedByTokenId: string): Promise<void>;
}
