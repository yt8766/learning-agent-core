import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  GatewayAuthErrorCode,
  GatewayLoginRequest,
  GatewayLoginResponse,
  GatewayRefreshResponse,
  GatewaySession,
  GatewayUser
} from '@agent/core';

type TokenKind = 'access' | 'refresh';
interface TokenPayload {
  kind: TokenKind;
  username: string;
  iat: number;
  exp: number;
}
export class AgentGatewayAuthError extends Error {
  constructor(
    readonly code: GatewayAuthErrorCode,
    message: string
  ) {
    super(message);
  }
}
const accessTtl = 15 * 60;
const refreshTtl = 7 * 24 * 60 * 60;
@Injectable()
export class AgentGatewayAuthService {
  private readonly secret = process.env.AGENT_GATEWAY_AUTH_SECRET ?? 'local-agent-gateway-secret';
  private readonly users = new Map<string, { password: string; profile: GatewayUser }>([
    [
      'admin',
      {
        password: 'admin123',
        profile: { id: 'gateway-admin', username: 'admin', displayName: '网关管理员', role: 'admin' }
      }
    ]
  ]);
  login(request: GatewayLoginRequest): GatewayLoginResponse {
    const account = this.users.get(request.username);
    if (!account || account.password !== request.password)
      throw new AgentGatewayAuthError('INVALID_CREDENTIALS', '用户名或密码错误');
    const now = this.now();
    return {
      accessToken: this.signToken({
        kind: 'access',
        username: account.profile.username,
        iat: now,
        exp: now + accessTtl
      }),
      refreshToken: this.signToken({
        kind: 'refresh',
        username: account.profile.username,
        iat: now,
        exp: now + refreshTtl
      }),
      accessTokenExpiresAt: this.iso(now + accessTtl),
      refreshTokenExpiresAt: this.iso(now + refreshTtl),
      refreshTokenStorage: 'localStorage',
      session: this.session(account.profile, now)
    };
  }
  refresh(refreshToken: string): GatewayRefreshResponse {
    const payload = this.verify(refreshToken, 'refresh');
    const account = this.users.get(payload.username);
    if (!account) throw new AgentGatewayAuthError('FORBIDDEN', '刷新令牌所属用户不存在');
    const now = this.now();
    return {
      accessToken: this.signToken({
        kind: 'access',
        username: account.profile.username,
        iat: now,
        exp: now + accessTtl
      }),
      accessTokenExpiresAt: this.iso(now + accessTtl),
      session: this.session(account.profile, now)
    };
  }
  verifyAccessToken(accessToken: string): GatewaySession {
    const payload = this.verify(accessToken, 'access');
    const account = this.users.get(payload.username);
    if (!account) throw new AgentGatewayAuthError('FORBIDDEN', '访问令牌所属用户不存在');
    return this.session(account.profile, payload.iat);
  }
  private verify(token: string, kind: TokenKind): TokenPayload {
    const [prefix, body, signature] = token.split('.');
    if (prefix !== 'gateway-' + kind || !body || !signature)
      throw new AgentGatewayAuthError(kind === 'access' ? 'UNAUTHENTICATED' : 'REFRESH_TOKEN_EXPIRED', '令牌格式无效');
    const expected = this.sign(prefix + '.' + body);
    if (!this.safe(signature, expected))
      throw new AgentGatewayAuthError(kind === 'access' ? 'UNAUTHENTICATED' : 'REFRESH_TOKEN_EXPIRED', '令牌签名无效');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.kind !== kind || payload.exp <= this.now())
      throw new AgentGatewayAuthError(
        kind === 'access' ? 'ACCESS_TOKEN_EXPIRED' : 'REFRESH_TOKEN_EXPIRED',
        '令牌已过期'
      );
    return payload;
  }
  private signToken(payload: TokenPayload): string {
    const prefix = 'gateway-' + payload.kind;
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return prefix + '.' + body + '.' + this.sign(prefix + '.' + body);
  }
  private sign(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url');
  }
  private safe(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private session(user: GatewayUser, issuedAt: number): GatewaySession {
    return { user, issuedAt: this.iso(issuedAt) };
  }
  private now(): number {
    return Math.floor(Date.now() / 1000);
  }
  private iso(seconds: number): string {
    return new Date(seconds * 1000).toISOString();
  }
}
