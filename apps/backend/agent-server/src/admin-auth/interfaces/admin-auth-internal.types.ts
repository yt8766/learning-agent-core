import type { AdminAccount, AdminAuthErrorCode, AdminRole } from '@agent/core';

export type AdminPrincipal = {
  accountId: string;
  sessionId: string;
  username: string;
  roles: AdminRole[];
};

export type AdminAccessTokenPayload = {
  sub: string;
  sid: string;
  username: string;
  roles: AdminRole[];
  tokenType: 'access';
  iat: number;
  exp: number;
};

export type AdminRefreshTokenPayload = {
  sub: string;
  sid: string;
  rotationId: string;
  tokenType: 'refresh';
  iat: number;
  exp: number;
};

export type AdminAuthPolicy = {
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  rememberedRefreshTokenTtlSeconds: number;
  maxFailedLoginAttempts: number;
  lockDurationSeconds: number;
};

export type AdminPasswordCredentialRecord = {
  id: string;
  accountId: string;
  passwordHash: string;
  passwordVersion: number;
  failedCount: number;
  lockedUntil?: string;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSessionRecord = {
  id: string;
  accountId: string;
  status: 'active' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt: string;
  lastSeenAt?: string;
  revokedAt?: string;
  revokeReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRefreshTokenRecord = {
  id: string;
  sessionId: string;
  accountId: string;
  tokenHash: string;
  rotationId: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  issuedAt: string;
  expiresAt: string;
  usedAt?: string;
  revokedAt?: string;
  replacedByTokenId?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuthAuditEventRecord = {
  id: string;
  type:
    | 'admin_login_succeeded'
    | 'admin_login_failed'
    | 'admin_logout'
    | 'admin_refresh_succeeded'
    | 'admin_refresh_failed'
    | 'admin_refresh_reuse_detected'
    | 'admin_session_revoked';
  accountId?: string;
  username?: string;
  sessionId?: string;
  result: 'success' | 'failure';
  reason?: AdminAuthErrorCode;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type AdminAccountRecord = AdminAccount;

export type CreateAdminSessionInput = {
  accountId: string;
  expiresAt: string;
  now: string;
};

export type CreateAdminRefreshTokenInput = {
  sessionId: string;
  accountId: string;
  tokenHash: string;
  rotationId: string;
  issuedAt: string;
  expiresAt: string;
};
