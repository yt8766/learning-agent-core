import { describe, expect, it } from 'vitest';

import { KnowledgeAuthService } from '../../src/knowledge/knowledge-auth.service';
import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeSessionRepository } from '../../src/knowledge/repositories/knowledge-session.repository';

describe('KnowledgeAuthService', () => {
  function createAuth(now: () => Date = () => new Date('2026-05-01T09:00:00.000Z')) {
    const sessions = new InMemoryKnowledgeSessionRepository();
    const auth = new KnowledgeAuthService({
      sessions,
      now,
      jwtSecret: 'local-test-secret'
    });

    return { auth, sessions };
  }

  it('rotates refresh tokens and invalidates the previous token', async () => {
    const { auth } = createAuth();

    const first = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const second = await auth.refresh({ refreshToken: first.tokens.refreshToken });

    await expect(auth.refresh({ refreshToken: first.tokens.refreshToken })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
    expect(second.tokens.refreshToken).not.toBe(first.tokens.refreshToken);
    expect(second.tokens.accessToken).not.toBe(first.tokens.accessToken);
  });

  it('returns exact login and refresh response shapes', async () => {
    const { auth } = createAuth();

    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const refresh = await auth.refresh({ refreshToken: login.tokens.refreshToken });

    expect(Object.keys(login).sort()).toEqual(['tokens', 'user']);
    expect(Object.keys(refresh).sort()).toEqual(['tokens']);
    expect(login.tokens.tokenType).toBe('Bearer');
    expect(refresh.tokens.tokenType).toBe('Bearer');
  });

  it('can authenticate a knowledge session from a database-backed admin account', async () => {
    const adminAuthenticator = {
      authenticate: async (input: { username: string; password: string }) =>
        input.username === 'admin' && input.password === 'rust123@'
          ? {
              id: 'admin_001',
              username: 'admin',
              displayName: '平台管理员',
              roles: ['super_admin']
            }
          : null
    };
    const auth = new KnowledgeAuthService({
      sessions: new InMemoryKnowledgeSessionRepository(),
      now: () => new Date('2026-05-01T09:00:00.000Z'),
      jwtSecret: 'local-test-secret',
      adminAuthenticator
    });

    const login = await auth.login({ email: 'admin', password: 'rust123@' });

    expect(login.user).toMatchObject({
      id: 'admin_001',
      email: 'admin',
      name: '平台管理员',
      roles: ['owner']
    });
    await expect(auth.login({ email: 'admin', password: 'wrong' })).rejects.toThrow();
  });

  it('stores only a refresh token hash in the session repository', async () => {
    const { auth, sessions } = createAuth();

    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const activeSession = await sessions.findActiveByRefreshTokenHash(auth.hashRefreshToken(login.tokens.refreshToken));

    expect(activeSession?.refreshTokenHash).not.toBe(login.tokens.refreshToken);
    expect(activeSession?.refreshTokenHash).toHaveLength(64);
  });

  it('revokes an active refresh token on logout and allows empty logout', async () => {
    const { auth } = createAuth();

    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    await expect(auth.logout({})).resolves.toEqual({ ok: true });
    await expect(auth.logout({ refreshToken: login.tokens.refreshToken })).resolves.toEqual({ ok: true });
    await expect(auth.refresh({ refreshToken: login.tokens.refreshToken })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
  });

  it('does not revoke another session when logout receives a malformed refresh token', async () => {
    const { auth } = createAuth();

    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    await expect(auth.logout({ refreshToken: 'not-a-token' })).resolves.toEqual({ ok: true });
    await expect(auth.me({ authorization: `Bearer ${login.tokens.accessToken}` })).resolves.toMatchObject({
      user: { id: login.user.id }
    });
  });

  it('rejects tampered refresh tokens', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const tampered = `${login.tokens.refreshToken.slice(0, -4)}oops`;

    await expect(auth.refresh({ refreshToken: tampered })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
  });

  it('rejects access tokens used as refresh tokens', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    await expect(auth.refresh({ refreshToken: login.tokens.accessToken })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
  });

  it('rejects expired refresh tokens', async () => {
    let currentTime = new Date('2026-05-01T09:00:00.000Z');
    const { auth } = createAuth(() => currentTime);
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    currentTime = new Date('2026-05-16T09:00:00.000Z');

    await expect(auth.refresh({ refreshToken: login.tokens.refreshToken })).rejects.toThrow(
      'Refresh token has been rotated or revoked.'
    );
  });

  it('rejects /me without bearer authorization', async () => {
    const { auth } = createAuth();

    await expect(auth.me({ authorization: undefined })).rejects.toThrow();
    await expect(auth.me({ authorization: 'Basic abc' })).rejects.toThrow();
  });

  it('rejects /me with a tampered access token', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const tampered = `${login.tokens.accessToken.slice(0, -4)}oops`;

    await expect(auth.me({ authorization: `Bearer ${tampered}` })).rejects.toThrow();
  });

  it('rejects /me with an expired access token', async () => {
    let currentTime = new Date('2026-05-01T09:00:00.000Z');
    const { auth } = createAuth(() => currentTime);
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    currentTime = new Date('2026-05-01T12:00:01.000Z');

    try {
      await auth.me({ authorization: `Bearer ${login.tokens.accessToken}` });
      expect.fail('Expected expired access token to throw');
    } catch (error) {
      const response =
        typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
          ? (error as { getResponse: () => unknown }).getResponse()
          : error;

      expect(response).toMatchObject({
        code: 'auth_token_expired',
        message: 'Access token has expired.'
      });
    }
  });

  it('returns the access token user from /me', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });
    const controller = new KnowledgeController(new KnowledgeService(), auth);

    await expect(controller.me(`Bearer ${login.tokens.accessToken}`)).resolves.toMatchObject({
      user: { id: login.user.id, email: login.user.email }
    });
  });

  it('rejects /me after the session is revoked by logout', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    await auth.logout({ refreshToken: login.tokens.refreshToken });

    await expect(auth.me({ authorization: `Bearer ${login.tokens.accessToken}` })).rejects.toThrow();
  });

  it('rejects /me for the previous access token after refresh rotation', async () => {
    const { auth } = createAuth();
    const login = await auth.login({ email: 'owner@example.com', password: 'demo-password' });

    await auth.refresh({ refreshToken: login.tokens.refreshToken });

    await expect(auth.me({ authorization: `Bearer ${login.tokens.accessToken}` })).rejects.toThrow();
  });

  it('requires an explicit JWT secret in production', () => {
    const previousProcess = globalThis.process;

    try {
      Object.defineProperty(globalThis, 'process', {
        configurable: true,
        value: { env: { NODE_ENV: 'production' } }
      });

      expect(() => new KnowledgeAuthService({ sessions: new InMemoryKnowledgeSessionRepository() })).toThrow(
        'KNOWLEDGE_JWT_SECRET must be configured in production.'
      );
    } finally {
      Object.defineProperty(globalThis, 'process', {
        configurable: true,
        value: previousProcess
      });
    }
  });
});
