import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import {
  type KnowledgeAuthSession,
  type KnowledgeLoginRequest,
  type KnowledgeLogoutRequest,
  type KnowledgeMeRequest,
  type KnowledgeRefreshRequest,
  type KnowledgeRefreshSession,
  type KnowledgeTokenPair,
  type KnowledgeUser
} from './interfaces/knowledge-auth.types';
import type { KnowledgeAdminAccount, KnowledgeAdminAuthenticator } from './knowledge-admin-authenticator';
import {
  KNOWLEDGE_SESSION_REPOSITORY,
  InMemoryKnowledgeSessionRepository,
  type KnowledgeSessionRecord,
  type KnowledgeSessionRepository
} from './repositories/knowledge-session.repository';

const ACCESS_TOKEN_TTL_SECONDS = 7200;
const REFRESH_TOKEN_TTL_SECONDS = 1209600;
const DEFAULT_JWT_SECRET = 'knowledge-local-development-secret';
const ROTATED_REFRESH_MESSAGE = 'Refresh token has been rotated or revoked.';

type KnowledgeTokenKind = 'knowledge-access' | 'knowledge-refresh';

interface KnowledgeTokenPayload {
  kind: KnowledgeTokenKind;
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
  nonce: string;
}

export interface KnowledgeAuthServiceOptions {
  sessions?: KnowledgeSessionRepository;
  adminAuthenticator?: KnowledgeAdminAuthenticator;
  now?: () => Date;
  jwtSecret?: string;
}

@Injectable()
export class KnowledgeAuthService {
  private readonly sessions: KnowledgeSessionRepository;
  private readonly adminAuthenticator?: KnowledgeAdminAuthenticator;
  private readonly now: () => Date;
  private readonly jwtSecret: string;

  constructor(
    options: KnowledgeAuthServiceOptions = {},
    @Inject(KNOWLEDGE_SESSION_REPOSITORY) injectedSessions?: KnowledgeSessionRepository
  ) {
    this.sessions = options.sessions ?? injectedSessions ?? new InMemoryKnowledgeSessionRepository();
    this.adminAuthenticator = options.adminAuthenticator;
    this.now = options.now ?? (() => new Date());
    this.jwtSecret = options.jwtSecret ?? getKnowledgeJwtSecret();
  }

  async login(input: KnowledgeLoginRequest): Promise<KnowledgeAuthSession> {
    if (!input.email?.trim() || !input.password?.trim()) {
      throw new UnauthorizedException({ code: 'auth_invalid_credentials', message: 'Invalid credentials' });
    }

    const user = await this.authenticateUser(input.email.trim(), input.password);
    const tokenPair = await this.issueTokenPair(user.id);

    return {
      user,
      tokens: tokenPair
    };
  }

  async refresh(input: KnowledgeRefreshRequest): Promise<KnowledgeRefreshSession> {
    const parsedRefreshToken = this.verifyToken(input.refreshToken, 'knowledge-refresh');

    const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
    const activeSession = await this.sessions.findActiveByRefreshTokenHash(refreshTokenHash);
    if (
      !activeSession ||
      this.isExpired(activeSession) ||
      activeSession.id !== parsedRefreshToken.sessionId ||
      activeSession.userId !== parsedRefreshToken.userId
    ) {
      throw this.rotatedRefreshTokenError();
    }

    const { tokens, session } = this.buildTokenPairAndSession(activeSession.userId);
    const rotatedSession = await this.sessions.rotateActiveSession({
      sessionId: activeSession.id,
      refreshTokenHash,
      newSession: session,
      revokedAt: this.now().toISOString()
    });
    if (!rotatedSession) {
      throw this.rotatedRefreshTokenError();
    }

    return {
      tokens
    };
  }

  async me(input: KnowledgeMeRequest) {
    const authorization = input.authorization?.trim();
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException({ code: 'auth_access_token_invalid', message: 'Invalid access token' });
    }

    const accessToken = authorization.slice('Bearer '.length).trim();
    const payload = this.verifyToken(accessToken, 'knowledge-access');
    const activeSession = await this.sessions.findActiveBySessionId(payload.sessionId);
    if (!activeSession || activeSession.userId !== payload.userId || this.isExpired(activeSession)) {
      throw this.accessTokenError();
    }

    return {
      user: await this.resolveUserById(payload.userId)
    };
  }

  async logout(input: KnowledgeLogoutRequest = {}) {
    if (input.refreshToken?.trim()) {
      const parsedRefreshToken = this.tryVerifyToken(input.refreshToken, 'knowledge-refresh');
      if (!parsedRefreshToken) {
        return { ok: true };
      }

      const refreshTokenHash = this.hashRefreshToken(input.refreshToken);
      const activeSession = await this.sessions.findActiveByRefreshTokenHash(refreshTokenHash);
      if (activeSession) {
        if (activeSession.id === parsedRefreshToken.sessionId && activeSession.userId === parsedRefreshToken.userId) {
          await this.sessions.revoke({ sessionId: activeSession.id, revokedAt: this.now().toISOString() });
        }
      }
    }

    return { ok: true };
  }

  hashRefreshToken(refreshToken: string) {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private async issueTokenPair(userId: string): Promise<KnowledgeTokenPair> {
    const { tokens, session } = this.buildTokenPairAndSession(userId);
    await this.sessions.create(session);
    return tokens;
  }

  private buildTokenPairAndSession(userId: string) {
    const sessionId = randomUUID();
    const refreshToken = this.signToken('knowledge-refresh', userId, sessionId, REFRESH_TOKEN_TTL_SECONDS);
    const session = {
      id: sessionId,
      userId,
      refreshTokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: this.afterSeconds(REFRESH_TOKEN_TTL_SECONDS).toISOString(),
      revokedAt: null,
      rotatedToSessionId: null
    };

    return {
      session,
      tokens: {
        accessToken: this.signToken('knowledge-access', userId, sessionId, ACCESS_TOKEN_TTL_SECONDS),
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS
      }
    } satisfies { session: KnowledgeSessionRecord; tokens: KnowledgeTokenPair };
  }

  private signToken(kind: KnowledgeTokenKind, userId: string, sessionId: string, ttlSeconds: number) {
    const issuedAtSeconds = Math.floor(this.now().getTime() / 1000);
    const payload: KnowledgeTokenPayload = {
      kind,
      userId,
      sessionId,
      iat: issuedAtSeconds,
      exp: issuedAtSeconds + ttlSeconds,
      nonce: randomBytes(12).toString('hex')
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret).update(`${kind}.${body}`).digest('base64url');
    return `${kind}.${body}.${signature}`;
  }

  private verifyToken(token: string | undefined, expectedKind: KnowledgeTokenKind) {
    if (!token?.trim()) {
      throw this.tokenError(expectedKind);
    }

    const [kind, body, signature, ...extraParts] = token.split('.');
    if (extraParts.length > 0 || kind !== expectedKind || !body || !signature) {
      throw this.tokenError(expectedKind);
    }

    const expectedSignature = createHmac('sha256', this.jwtSecret).update(`${kind}.${body}`).digest('base64url');
    if (!this.hasMatchingSignature(signature, expectedSignature)) {
      throw this.tokenError(expectedKind);
    }

    const payload = this.parseTokenPayload(body, expectedKind);
    if (payload.exp <= Math.floor(this.now().getTime() / 1000)) {
      if (expectedKind === 'knowledge-access') {
        throw this.accessTokenExpiredError();
      }
      throw this.tokenError(expectedKind);
    }

    return payload;
  }

  private afterSeconds(seconds: number) {
    return new Date(this.now().getTime() + seconds * 1000);
  }

  private isExpired(session: KnowledgeSessionRecord) {
    return new Date(session.expiresAt).getTime() <= this.now().getTime();
  }

  private async authenticateUser(username: string, password: string): Promise<KnowledgeUser> {
    if (!this.adminAuthenticator) {
      return this.getStubUser(username);
    }

    const account = await this.adminAuthenticator.authenticate({ username, password });
    if (!account) {
      throw new UnauthorizedException({ code: 'auth_invalid_credentials', message: 'Invalid credentials' });
    }

    return this.getAdminUser(account);
  }

  private async resolveUserById(userId: string): Promise<KnowledgeUser> {
    const account = await this.adminAuthenticator?.findById?.(userId);
    return account ? this.getAdminUser(account) : this.getStubUserById(userId);
  }

  private getAdminUser(account: KnowledgeAdminAccount): KnowledgeUser {
    return {
      id: account.id,
      email: account.username,
      name: account.displayName,
      currentWorkspaceId: 'ws_1',
      roles: ['owner'],
      permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
    };
  }

  private getStubUser(email: string): KnowledgeUser {
    return {
      id: 'user_1',
      email,
      name: 'Knowledge User',
      currentWorkspaceId: 'ws_1',
      roles: ['owner'],
      permissions: ['knowledge:read', 'knowledge:write', 'document:upload', 'chat:write', 'eval:run', 'trace:read']
    };
  }

  private getStubUserById(userId: string): KnowledgeUser {
    return {
      ...this.getStubUser('owner@example.com'),
      id: userId
    };
  }

  private parseTokenPayload(body: string, expectedKind: KnowledgeTokenKind) {
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<KnowledgeTokenPayload>;
      if (
        payload.kind !== expectedKind ||
        typeof payload.userId !== 'string' ||
        !payload.userId ||
        typeof payload.sessionId !== 'string' ||
        !payload.sessionId ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number' ||
        typeof payload.nonce !== 'string' ||
        !payload.nonce
      ) {
        throw new Error('Invalid token payload');
      }

      return payload as KnowledgeTokenPayload;
    } catch {
      throw this.tokenError(expectedKind);
    }
  }

  private tokenError(kind: KnowledgeTokenKind) {
    if (kind === 'knowledge-refresh') {
      return this.rotatedRefreshTokenError();
    }

    return this.accessTokenError();
  }

  private tryVerifyToken(token: string, expectedKind: KnowledgeTokenKind) {
    try {
      return this.verifyToken(token, expectedKind);
    } catch {
      return null;
    }
  }

  private hasMatchingSignature(signature: string, expectedSignature: string) {
    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);
    return (
      signatureBuffer.length === expectedSignatureBuffer.length &&
      timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    );
  }

  private accessTokenError() {
    return new UnauthorizedException({ code: 'auth_access_token_invalid', message: 'Invalid access token' });
  }

  private accessTokenExpiredError() {
    return new UnauthorizedException({ code: 'auth_token_expired', message: 'Access token has expired.' });
  }

  private rotatedRefreshTokenError() {
    return new UnauthorizedException({ code: 'auth_refresh_token_revoked', message: ROTATED_REFRESH_MESSAGE });
  }
}

function getKnowledgeJwtSecret() {
  const processLike = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const secret = processLike?.env?.KNOWLEDGE_JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (processLike?.env?.NODE_ENV === 'production') {
    throw new Error('KNOWLEDGE_JWT_SECRET must be configured in production.');
  }
  return DEFAULT_JWT_SECRET;
}
