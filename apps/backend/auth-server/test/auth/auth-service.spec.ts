import { describe, expect, it } from 'vitest';

import { AuthService } from '../../src/auth/auth.service';
import { JwtProvider } from '../../src/auth/jwt.provider';
import { PasswordHasherProvider } from '../../src/auth/password-hasher.provider';
import { InMemoryAuthRepository } from '../../src/auth/repositories/auth-memory.repository';

describe('AuthService', () => {
  async function createService() {
    const repository = new InMemoryAuthRepository();
    const hasher = new PasswordHasherProvider();
    const jwt = new JwtProvider({ secret: 'test-secret', issuer: 'auth-server' });
    const service = new AuthService(repository, hasher, jwt);

    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await hasher.hash('admin-password')
    });

    return { service, repository };
  }

  it('logs in with username and password', async () => {
    const { service } = await createService();

    const response = await service.login({ username: 'admin', password: 'admin-password', remember: false });

    expect(response.account.username).toBe('admin');
    expect(response.tokens.tokenType).toBe('Bearer');
    expect(response.tokens.accessToken).toContain('.');
    expect(response.tokens.refreshToken).toHaveLength(64);
  });

  it('rejects disabled users', async () => {
    const { service, repository } = await createService();
    await repository.updateUserStatus('user_admin', 'disabled');

    await expect(
      service.login({ username: 'admin', password: 'admin-password', remember: false })
    ).rejects.toMatchObject({
      code: 'account_disabled'
    });
  });

  it('rotates refresh tokens and revokes the session on token replay', async () => {
    const { service } = await createService();
    const login = await service.login({ username: 'admin', password: 'admin-password', remember: false });
    const refresh = await service.refresh({ refreshToken: login.tokens.refreshToken });

    expect(refresh.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    await expect(service.refresh({ refreshToken: login.tokens.refreshToken })).rejects.toMatchObject({
      code: 'refresh_token_reused'
    });
    await expect(service.refresh({ refreshToken: refresh.tokens.refreshToken })).rejects.toMatchObject({
      code: 'session_revoked'
    });
  });
});
