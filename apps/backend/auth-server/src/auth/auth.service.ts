import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthMeResponse,
  AuthRefreshRequest,
  AuthRefreshResponse
} from '@agent/core';

import { AuthServiceError } from './auth.errors';
import { JwtProvider } from './jwt.provider';
import { PasswordHasherProvider } from './password-hasher.provider';
import type { AuthRepository, AuthUserRecord } from './repositories/auth.repository';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const REMEMBER_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasherProvider,
    private readonly jwt: JwtProvider
  ) {}

  async login(input: AuthLoginRequest): Promise<AuthLoginResponse> {
    const user = await this.repository.findUserByUsername(input.username);
    if (!user || !(await this.hasher.verify(input.password, user.passwordHash))) {
      throw new AuthServiceError('invalid_credentials', '账号或密码错误');
    }
    if (user.status === 'disabled') {
      throw new AuthServiceError('account_disabled', '账号已禁用');
    }

    const now = Date.now();
    const refreshExpiresAt = new Date(now + (input.remember ? REMEMBER_REFRESH_TOKEN_TTL_MS : REFRESH_TOKEN_TTL_MS));
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

  async refresh(input: AuthRefreshRequest): Promise<AuthRefreshResponse> {
    const tokenHash = hashToken(input.refreshToken);
    const existingToken = await this.repository.findRefreshTokenByHash(tokenHash);
    if (!existingToken) {
      throw new AuthServiceError('refresh_token_invalid', 'Refresh Token 无效');
    }

    const session = await this.repository.findSession(existingToken.sessionId);
    if (!session || session.status !== 'active') {
      throw new AuthServiceError('session_revoked', 'Session 已失效');
    }
    if (new Date(existingToken.expiresAt).getTime() <= Date.now()) {
      throw new AuthServiceError('refresh_token_expired', 'Refresh Token 已过期');
    }
    if (existingToken.status === 'used') {
      await this.repository.revokeSession(existingToken.sessionId, 'refresh-token-reuse');
      throw new AuthServiceError('refresh_token_reused', 'Refresh Token 被重复使用');
    }
    if (existingToken.status !== 'active') {
      throw new AuthServiceError('refresh_token_invalid', 'Refresh Token 无效');
    }

    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== 'enabled') {
      await this.repository.revokeSession(session.id, 'user-unavailable');
      throw new AuthServiceError('session_revoked', 'Session 已失效');
    }

    const refreshExpiresAt = new Date(existingToken.expiresAt);
    const tokens = await this.issueTokens(user, session.id, refreshExpiresAt);
    const replacement = await this.repository.findRefreshTokenByHash(hashToken(tokens.refreshToken));
    if (replacement) {
      await this.repository.markRefreshTokenUsed(existingToken.id, replacement.id);
    }

    return { tokens };
  }

  verifyAccessToken(accessToken: string) {
    return this.jwt.verify(accessToken);
  }

  async getCurrentUser(accessToken: string): Promise<AuthMeResponse> {
    return this.getCurrentUserFromPayload(this.verifyAccessToken(accessToken));
  }

  async getCurrentUserFromPayload(payload: ReturnType<JwtProvider['verify']>): Promise<AuthMeResponse> {
    const session = await this.repository.findSession(payload.sid);
    const user = await this.repository.findUserById(payload.sub);
    if (!session || session.status !== 'active' || !user || user.status !== 'enabled') {
      throw new AuthServiceError('access_token_invalid', 'Access Token 无效');
    }

    return { account: toAccount(user) };
  }

  async logout(input: { refreshToken: string }): Promise<{ success: true }> {
    const existingToken = await this.repository.findRefreshTokenByHash(hashToken(input.refreshToken));
    if (existingToken) {
      await this.repository.revokeSession(existingToken.sessionId, 'logout');
    }
    return { success: true };
  }

  private async issueTokens(
    user: AuthUserRecord,
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
        aud: ['agent-admin', 'knowledge'],
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

function toAccount(user: AuthUserRecord): AuthLoginResponse['account'] {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    status: user.status
  };
}
