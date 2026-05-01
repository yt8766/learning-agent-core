import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  AdminLoginRequestSchema,
  AdminLogoutRequestSchema,
  AdminRefreshRequestSchema,
  type AdminLoginRequest,
  type AdminLoginResponse,
  type AdminLogoutRequest,
  type AdminLogoutResponse,
  type AdminMeResponse,
  type AdminRefreshRequest,
  type AdminRefreshResponse
} from '@agent/core';

import { adminAuthError } from './admin-auth.errors';
import { defaultAdminAuthPolicy } from './admin-auth-policy';
import { AdminJwtProvider } from './admin-jwt.provider';
import type { AdminAuthPolicy, AdminPrincipal, AdminRefreshTokenRecord } from './interfaces/admin-auth-internal.types';
import { PasswordHasherProvider } from './password-hasher.provider';
import { AdminAuthRepository } from './repositories/admin-auth.repository';

@Injectable()
export class AdminAuthService {
  private readonly authPolicy: AdminAuthPolicy;
  private readonly currentTime: () => Date;

  constructor(
    private readonly repository: AdminAuthRepository,
    private readonly jwtProvider: AdminJwtProvider,
    private readonly passwordHasher: PasswordHasherProvider,
    @Optional() @Inject('ADMIN_AUTH_POLICY') policy?: AdminAuthPolicy,
    @Optional() @Inject('ADMIN_AUTH_NOW') now?: () => Date
  ) {
    this.authPolicy = policy ?? defaultAdminAuthPolicy;
    this.currentTime = now ?? (() => new Date());
  }

  async login(input: AdminLoginRequest): Promise<AdminLoginResponse> {
    const request = AdminLoginRequestSchema.parse(input);
    const now = this.currentTime();
    const nowIso = now.toISOString();
    const account = await this.repository.findAccountByUsername(request.username);
    if (!account) {
      await this.audit('admin_login_failed', 'failure', nowIso, {
        username: request.username,
        reason: 'invalid_credentials'
      });
      throw adminAuthError.invalidCredentials();
    }
    if (account.status === 'disabled') {
      await this.audit('admin_login_failed', 'failure', nowIso, {
        accountId: account.id,
        username: account.username,
        reason: 'account_disabled'
      });
      throw adminAuthError.accountDisabled();
    }

    const credential = await this.repository.findPasswordCredentialByAccountId(account.id);
    if (!credential) {
      throw adminAuthError.invalidCredentials();
    }
    if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > now.getTime()) {
      throw adminAuthError.accountLocked();
    }

    const passwordMatches = await this.passwordHasher.verifyPassword(request.password, credential.passwordHash);
    if (!passwordMatches) {
      const failedCount = credential.failedCount + 1;
      const locked = failedCount >= this.authPolicy.maxFailedLoginAttempts;
      await this.repository.updatePasswordCredential({
        ...credential,
        failedCount,
        lockedUntil: locked
          ? addSeconds(now, this.authPolicy.lockDurationSeconds).toISOString()
          : credential.lockedUntil,
        updatedAt: nowIso
      });
      await this.audit('admin_login_failed', 'failure', nowIso, {
        accountId: account.id,
        username: account.username,
        reason: locked ? 'account_locked' : 'invalid_credentials'
      });
      throw locked ? adminAuthError.accountLocked() : adminAuthError.invalidCredentials();
    }

    await this.repository.updatePasswordCredential({
      ...credential,
      failedCount: 0,
      lockedUntil: undefined,
      updatedAt: nowIso
    });
    const updatedAccount = {
      ...account,
      lastLoginAt: nowIso,
      updatedAt: nowIso
    };
    await this.repository.updateAccount(updatedAccount);

    const refreshTtl = request.remember
      ? this.authPolicy.rememberedRefreshTokenTtlSeconds
      : this.authPolicy.refreshTokenTtlSeconds;
    const session = await this.repository.createSession({
      accountId: account.id,
      expiresAt: addSeconds(now, refreshTtl).toISOString(),
      now: nowIso
    });
    const tokens = await this.issueTokenPair(updatedAccount, session.id, refreshTtl, now);
    await this.audit('admin_login_succeeded', 'success', nowIso, {
      accountId: account.id,
      username: account.username,
      sessionId: session.id
    });

    return {
      account: updatedAccount,
      session: {
        id: session.id,
        expiresAt: session.expiresAt
      },
      tokens
    };
  }

  async refresh(input: AdminRefreshRequest): Promise<AdminRefreshResponse> {
    const request = AdminRefreshRequestSchema.parse(input);
    if (!request.refreshToken) {
      throw adminAuthError.refreshTokenMissing();
    }
    const now = this.currentTime();
    const nowIso = now.toISOString();
    const payload = this.jwtProvider.verifyRefreshToken(request.refreshToken, now);
    const session = await this.repository.findSessionById(payload.sid);
    if (!session || session.status !== 'active') {
      throw adminAuthError.sessionRevoked();
    }
    const account = await this.repository.findAccountById(payload.sub);
    if (!account || account.status === 'disabled') {
      await this.revokeSession(session.id, 'account_disabled', nowIso);
      throw account ? adminAuthError.accountDisabled() : adminAuthError.sessionRevoked();
    }
    const record = await this.repository.findRefreshTokenByHash(hashToken(request.refreshToken));
    if (!record) {
      throw adminAuthError.refreshTokenInvalid();
    }
    if (record.status === 'used') {
      await this.revokeSessionForReplay(record, nowIso);
      throw adminAuthError.sessionRevoked();
    }
    if (record.status === 'revoked') {
      throw adminAuthError.refreshTokenInvalid();
    }
    if (record.status === 'expired' || new Date(record.expiresAt).getTime() <= now.getTime()) {
      throw adminAuthError.refreshTokenExpired();
    }

    const refreshTtl = Math.max(1, Math.floor((new Date(record.expiresAt).getTime() - now.getTime()) / 1000));
    const tokens = await this.issueTokenPair(account, session.id, refreshTtl, now);
    const newRecord = await this.repository.findRefreshTokenByHash(hashToken(tokens.refreshToken));
    const marked = await this.repository.markRefreshTokenUsedIfActive(record.id, newRecord?.id ?? '', nowIso);
    if (!marked) {
      const latest = await this.repository.findRefreshTokenByHash(hashToken(request.refreshToken));
      if (latest?.status === 'used') {
        await this.revokeSessionForReplay(latest, nowIso);
      }
      throw adminAuthError.sessionRevoked();
    }
    await this.repository.updateSession({
      ...session,
      lastSeenAt: nowIso,
      updatedAt: nowIso
    });
    await this.audit('admin_refresh_succeeded', 'success', nowIso, {
      accountId: account.id,
      username: account.username,
      sessionId: session.id
    });
    return { tokens };
  }

  async logout(input: AdminLogoutRequest = {}, principal?: AdminPrincipal): Promise<AdminLogoutResponse> {
    const request = AdminLogoutRequestSchema.parse(input);
    const nowIso = this.currentTime().toISOString();
    if (principal) {
      await this.revokeSession(principal.sessionId, 'logout', nowIso);
    }
    if (request.refreshToken) {
      const record = await this.repository.findRefreshTokenByHash(hashToken(request.refreshToken));
      if (record) {
        await this.repository.revokeRefreshToken(record.id, nowIso);
        await this.repository.revokeActiveRefreshTokensBySessionId(record.sessionId, nowIso);
      }
    }
    await this.audit('admin_logout', 'success', nowIso, {
      accountId: principal?.accountId,
      username: principal?.username,
      sessionId: principal?.sessionId
    });
    return { success: true };
  }

  async getMe(principal: AdminPrincipal): Promise<AdminMeResponse> {
    const account = await this.repository.findAccountById(principal.accountId);
    if (!account) {
      throw adminAuthError.accessTokenInvalid();
    }
    if (account.status === 'disabled') {
      throw adminAuthError.accountDisabled();
    }
    const session = await this.repository.findSessionById(principal.sessionId);
    if (!session || session.status !== 'active') {
      throw adminAuthError.sessionRevoked();
    }
    return { account };
  }

  async verifyAccessToken(accessToken: string): Promise<AdminPrincipal> {
    return this.jwtProvider.toPrincipal(this.jwtProvider.verifyAccessToken(accessToken, this.currentTime()));
  }

  private async issueTokenPair(
    account: AdminLoginResponse['account'],
    sessionId: string,
    refreshTtlSeconds: number,
    now: Date
  ) {
    const rotationId = this.jwtProvider.createRotationId();
    const accessToken = this.jwtProvider.signAccessToken({
      sub: account.id,
      sid: sessionId,
      username: account.username,
      roles: account.roles,
      ttlSeconds: this.authPolicy.accessTokenTtlSeconds,
      now
    });
    const refreshToken = this.jwtProvider.signRefreshToken({
      sub: account.id,
      sid: sessionId,
      rotationId,
      ttlSeconds: refreshTtlSeconds,
      now
    });
    await this.repository.createRefreshToken({
      sessionId,
      accountId: account.id,
      tokenHash: hashToken(refreshToken),
      rotationId,
      issuedAt: now.toISOString(),
      expiresAt: addSeconds(now, refreshTtlSeconds).toISOString()
    });
    return {
      tokenType: 'Bearer' as const,
      accessToken,
      accessTokenExpiresAt: addSeconds(now, this.authPolicy.accessTokenTtlSeconds).toISOString(),
      refreshToken,
      refreshTokenExpiresAt: addSeconds(now, refreshTtlSeconds).toISOString()
    };
  }

  private async revokeSessionForReplay(record: AdminRefreshTokenRecord, nowIso: string): Promise<void> {
    await this.revokeSession(record.sessionId, 'refresh_token_replay', nowIso);
    await this.audit('admin_refresh_reuse_detected', 'failure', nowIso, {
      accountId: record.accountId,
      sessionId: record.sessionId,
      reason: 'session_revoked'
    });
  }

  private async revokeSession(sessionId: string, reason: string, nowIso: string): Promise<void> {
    await this.repository.revokeSession(sessionId, reason, nowIso);
    await this.repository.revokeActiveRefreshTokensBySessionId(sessionId, nowIso);
  }

  private async audit(
    type: Parameters<AdminAuthRepository['appendAuditEvent']>[0]['type'],
    result: 'success' | 'failure',
    nowIso: string,
    input: Omit<Parameters<AdminAuthRepository['appendAuditEvent']>[0], 'id' | 'type' | 'result' | 'createdAt'>
  ): Promise<void> {
    await this.repository.appendAuditEvent({
      id: `admin_auth_audit_${randomUUID()}`,
      type,
      result,
      createdAt: nowIso,
      ...input
    });
  }
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
