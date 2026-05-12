import { describe, expect, it } from 'vitest';

import { AdminJwtProvider } from '../../src/admin-auth/admin-jwt.provider';

describe('AdminJwtProvider', () => {
  function makeProvider(secret = 'test-secret') {
    return new AdminJwtProvider(secret);
  }

  describe('signAccessToken and verifyAccessToken', () => {
    it('signs and verifies an access token', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });

      const payload = provider.verifyAccessToken(token, now);
      expect(payload.sub).toBe('account-1');
      expect(payload.sid).toBe('session-1');
      expect(payload.username).toBe('admin');
      expect(payload.roles).toEqual(['admin']);
      expect(payload.tokenType).toBe('access');
    });

    it('rejects expired access token', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 60,
        now
      });

      const future = new Date('2026-05-01T00:02:00.000Z');
      expect(() => provider.verifyAccessToken(token, future)).toThrow();
    });

    it('rejects token with wrong tokenType', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      // Sign a refresh token and try to verify as access
      const token = provider.signRefreshToken({
        sub: 'account-1',
        sid: 'session-1',
        rotationId: 'rot-1',
        ttlSeconds: 3600,
        now
      });

      expect(() => provider.verifyAccessToken(token, now)).toThrow();
    });

    it('rejects token with invalid signature', () => {
      const provider1 = makeProvider('secret-1');
      const provider2 = makeProvider('secret-2');
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider1.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });

      expect(() => provider2.verifyAccessToken(token, now)).toThrow();
    });

    it('rejects malformed token', () => {
      const provider = makeProvider();
      expect(() => provider.verifyAccessToken('not-a-token')).toThrow();
      expect(() => provider.verifyAccessToken('')).toThrow();
      expect(() => provider.verifyAccessToken('a.b')).toThrow();
    });

    it('rejects token with invalid base64 payload', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });
      // Corrupt the payload
      const parts = token.split('.');
      const corrupted = `${parts[0]}.!!!${parts[1]}.${parts[2]}`;
      expect(() => provider.verifyAccessToken(corrupted, now)).toThrow();
    });
  });

  describe('signRefreshToken and verifyRefreshToken', () => {
    it('signs and verifies a refresh token', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signRefreshToken({
        sub: 'account-1',
        sid: 'session-1',
        rotationId: 'rot-1',
        ttlSeconds: 86400,
        now
      });

      const payload = provider.verifyRefreshToken(token, now);
      expect(payload.sub).toBe('account-1');
      expect(payload.sid).toBe('session-1');
      expect(payload.rotationId).toBe('rot-1');
      expect(payload.tokenType).toBe('refresh');
    });

    it('rejects expired refresh token', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signRefreshToken({
        sub: 'account-1',
        sid: 'session-1',
        rotationId: 'rot-1',
        ttlSeconds: 60,
        now
      });

      const future = new Date('2026-05-01T00:02:00.000Z');
      expect(() => provider.verifyRefreshToken(token, future)).toThrow();
    });

    it('rejects access token verified as refresh', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });

      expect(() => provider.verifyRefreshToken(token, now)).toThrow();
    });
  });

  describe('toPrincipal', () => {
    it('converts payload to principal', () => {
      const provider = makeProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin', 'viewer'],
        ttlSeconds: 3600,
        now
      });

      const payload = provider.verifyAccessToken(token, now);
      const principal = provider.toPrincipal(payload);
      expect(principal.accountId).toBe('account-1');
      expect(principal.sessionId).toBe('session-1');
      expect(principal.username).toBe('admin');
      expect(principal.roles).toEqual(['admin', 'viewer']);
    });
  });

  describe('createRotationId', () => {
    it('creates unique rotation ids', () => {
      const provider = makeProvider();
      const id1 = provider.createRotationId();
      const id2 = provider.createRotationId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^admin_rot_/);
    });
  });

  describe('constructor', () => {
    it('uses default secret when none provided', () => {
      const provider = new AdminJwtProvider();
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });
      // Should not throw
      const payload = provider.verifyAccessToken(token, now);
      expect(payload.sub).toBe('account-1');
    });

    it('uses injected secret when provided', () => {
      const provider = new AdminJwtProvider('custom-secret');
      const now = new Date('2026-05-01T00:00:00.000Z');
      const token = provider.signAccessToken({
        sub: 'account-1',
        sid: 'session-1',
        username: 'admin',
        roles: ['admin'],
        ttlSeconds: 3600,
        now
      });
      const payload = provider.verifyAccessToken(token, now);
      expect(payload.sub).toBe('account-1');

      // Different secret should fail
      const other = new AdminJwtProvider('other-secret');
      expect(() => other.verifyAccessToken(token, now)).toThrow();
    });
  });
});
