import { describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { toAuthHttpError } from '../../src/auth/filters/auth-exception.filter';
import { JwtProvider } from '../../src/auth/jwt.provider';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';
import { UserManagementService } from '../../src/auth/user-management.service';

describe('auth HTTP behavior backing service', () => {
  async function createServices() {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const jwt = new JwtProvider({ secret: 'test-secret', issuer: 'auth-server' });
    const users = new UserManagementService(repository, hasher);
    const auth = new AuthService(repository, hasher, jwt);

    await users.createUser({
      username: 'admin',
      displayName: 'Admin',
      password: 'secret-123',
      roles: ['admin']
    });

    return { auth };
  }

  it('returns current user from an issued access token', async () => {
    const { auth } = await createServices();
    const login = await auth.login({ username: 'admin', password: 'secret-123', remember: false });

    const me = await auth.getCurrentUser(login.tokens.accessToken);

    expect(me.account.username).toBe('admin');
    expect(me.account.roles).toContain('admin');
  });

  it('revokes refresh token sessions on logout', async () => {
    const { auth } = await createServices();
    const login = await auth.login({ username: 'admin', password: 'secret-123', remember: false });

    await expect(auth.logout({ refreshToken: login.tokens.refreshToken })).resolves.toEqual({ success: true });
    await expect(auth.refresh({ refreshToken: login.tokens.refreshToken })).rejects.toMatchObject({
      code: 'session_revoked'
    });
  });

  it('maps auth service errors to stable HTTP response bodies', () => {
    const result = toAuthHttpError({ code: 'insufficient_role', message: 'Forbidden' });

    expect(result).toEqual({
      status: 403,
      body: {
        error: {
          code: 'insufficient_role',
          message: 'Forbidden',
          requestId: 'auth-server'
        }
      }
    });
  });
});
