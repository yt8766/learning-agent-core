import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AuthLoginRequestSchema,
  AuthLogoutRequestSchema,
  AuthRefreshRequestSchema,
  type AuthLoginRequest,
  type AuthLoginResponse,
  type AuthMeResponse,
  type AuthRefreshRequest,
  type AuthRefreshResponse
} from '@agent/core';

import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
  type IdentityUserRecord
} from '../repositories/identity.repository';
import { IdentityJwtProvider, type IdentityJwtPayload } from './identity-jwt.provider';
import { IdentityPasswordService } from './identity-password.service';
import { IdentityServiceError } from './identity-service.error';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class IdentityAuthService {
  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    private readonly password: IdentityPasswordService,
    private readonly jwt: IdentityJwtProvider
  ) {}

  async login(body: unknown): Promise<AuthLoginResponse> {
    const input = AuthLoginRequestSchema.parse(body);
    const user = await this.validateCredentials(input.username, input.password);
    return this.loginValidatedUser(user, input.remember ?? false);
  }

  async validateCredentials(username: string, password: string): Promise<IdentityUserRecord> {
    const user = await this.repository.findUserByUsername(username);
    if (!user || !(await this.password.verify(password, user.passwordHash))) {
      throw new IdentityServiceError('invalid_credentials', '账号或密码错误');
    }
    if (user.status === 'disabled') {
      throw new IdentityServiceError('account_disabled', '账号已禁用');
    }

    return user;
  }

  async loginValidatedUser(user: IdentityUserRecord, remember: boolean): Promise<AuthLoginResponse> {
    const now = Date.now();
    const refreshExpiresAt = new Date(now + (remember ? REMEMBER_REFRESH_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS));
    const session = await this.repository.createSession({
      id: `sess_${randomUUID()}`,
      userId: user.id,
      status: 'active',
      expiresAt: refreshExpiresAt.toISOString()
    });
    const tokens = await this.issueTokens(user, session.id, refreshExpiresAt);

    return {
      account: toAccount(user),
      session: { id: session.id, expiresAt: session.expiresAt },
      tokens
    };
  }

  async refresh(body: unknown): Promise<AuthRefreshResponse> {
    const input = AuthRefreshRequestSchema.parse(body);
    return this.refreshValidated(input);
  }

  async refreshValidated(input: AuthRefreshRequest): Promise<AuthRefreshResponse> {
    const tokenHash = hashToken(input.refreshToken);
    const existingToken = await this.repository.findRefreshTokenByHash(tokenHash);
    if (!existingToken) {
      throw new IdentityServiceError('refresh_token_invalid', 'Refresh Token 无效');
    }

    const session = await this.repository.findSession(existingToken.sessionId);
    if (!session || session.status !== 'active') {
      throw new IdentityServiceError('session_revoked', 'Session 已失效');
    }
    if (new Date(existingToken.expiresAt).getTime() <= Date.now()) {
      throw new IdentityServiceError('refresh_token_expired', 'Refresh Token 已过期');
    }
    if (existingToken.status === 'used') {
      await this.repository.revokeSession(existingToken.sessionId, 'refresh-token-reuse');
      throw new IdentityServiceError('refresh_token_reused', 'Refresh Token 被重复使用');
    }
    if (existingToken.status !== 'active') {
      throw new IdentityServiceError('refresh_token_invalid', 'Refresh Token 无效');
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== 'enabled') {
      await this.repository.revokeSession(session.id, 'user-unavailable');
      throw new IdentityServiceError('session_revoked', 'Session 已失效');
    }

    const refreshExpiresAt = new Date(existingToken.expiresAt);
    const tokens = await this.issueTokens(user, session.id, refreshExpiresAt);
    const replacement = await this.repository.findRefreshTokenByHash(hashToken(tokens.refreshToken));
    if (replacement) {
      await this.repository.markRefreshTokenUsed(existingToken.id, replacement.id);
    }

    return { tokens };
  }

  verifyAccessToken(accessToken: string): IdentityJwtPayload {
    try {
      return this.jwt.verify(accessToken);
    } catch {
      throw new IdentityServiceError('access_token_invalid', 'Access Token 无效');
    }
  }

  async getCurrentUser(accessToken: string): Promise<AuthMeResponse> {
    return this.getCurrentUserFromPayload(this.verifyAccessToken(accessToken));
  }

  async getCurrentUserFromPayload(payload: IdentityJwtPayload): Promise<AuthMeResponse> {
    const session = await this.repository.findSession(payload.sid);
    const user = await this.repository.findUserById(payload.sub);
    if (!session || session.status !== 'active' || !user || user.status !== 'enabled') {
      throw new IdentityServiceError('access_token_invalid', 'Access Token 无效');
    }

    return { account: toAccount(user) };
  }

  async logout(body: unknown): Promise<{ success: true }> {
    const input = AuthLogoutRequestSchema.parse(body);
    const existingToken = await this.repository.findRefreshTokenByHash(hashToken(input.refreshToken));
    if (existingToken) {
      await this.repository.revokeSession(existingToken.sessionId, 'logout');
    }
    return { success: true };
  }

  async me(principalOrAccessToken: unknown): Promise<AuthMeResponse> {
    if (typeof principalOrAccessToken === 'string') {
      return this.getCurrentUser(principalOrAccessToken);
    }

    if (isAccessTokenCarrier(principalOrAccessToken)) {
      return this.getCurrentUser(principalOrAccessToken.accessToken);
    }

    if (isIdentityPrincipal(principalOrAccessToken)) {
      return this.getCurrentUserFromPayload(principalOrAccessToken);
    }

    throw new IdentityServiceError('access_token_missing', 'Access Token 缺失');
  }

  private async issueTokens(
    user: IdentityUserRecord,
    sessionId: string,
    refreshExpiresAt: Date
  ): Promise<AuthLoginResponse['tokens']> {
    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
    const refreshToken = randomBytes(32).toString('hex');
    await this.repository.createRefreshToken({
      id: `rt_${randomUUID()}`,
      sessionId,
      tokenHash: hashToken(refreshToken),
      status: 'active',
      expiresAt: refreshExpiresAt.toISOString()
    });

    return {
      tokenType: 'Bearer',
      accessToken: this.jwt.sign({
        sub: user.id,
        sid: sessionId,
        username: user.username,
        roles: user.roles,
        status: user.status,
        aud: ['agent-admin', 'agent-gateway', 'knowledge'],
        exp: Math.floor(accessTokenExpiresAt.getTime() / 1000)
      }),
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString()
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toAccount(user: IdentityUserRecord): AuthLoginResponse['account'] {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}

function isAccessTokenCarrier(value: unknown): value is { accessToken: string } {
  return typeof value === 'object' && value !== null && 'accessToken' in value && typeof value.accessToken === 'string';
}

function isIdentityPrincipal(value: unknown): value is IdentityJwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    typeof value.sub === 'string' &&
    'sid' in value &&
    typeof value.sid === 'string'
  );
}
