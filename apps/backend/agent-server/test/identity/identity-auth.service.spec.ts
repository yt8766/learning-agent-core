import { describe, expect, it } from 'vitest';

import { IdentityAuthService } from '../../src/domains/identity/services/identity-auth.service';
import { IdentityJwtProvider } from '../../src/domains/identity/services/identity-jwt.provider';
import { IdentityPasswordService } from '../../src/domains/identity/services/identity-password.service';
import { IdentityMemoryRepository } from '../../src/domains/identity/repositories/identity-memory.repository';
import { IdentityServiceError } from '../../src/domains/identity/services/identity-service.error';

describe('IdentityAuthService', () => {
  async function createService() {
    const repository = new IdentityMemoryRepository();
    const password = new IdentityPasswordService();
    const jwt = new IdentityJwtProvider({ secret: 'test-secret', issuer: 'agent-server-identity' });
    const service = new IdentityAuthService(repository, password, jwt);

    await repository.createUser({
      id: 'user_admin',
      username: 'admin',
      displayName: 'Admin',
      roles: ['admin'],
      status: 'enabled',
      passwordHash: await password.hash('admin-password')
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
    expect(service.verifyAccessToken(response.tokens.accessToken).aud).toContain('agent-gateway');
  });

  it('rotates refresh tokens and revokes the session on refresh token reuse', async () => {
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

  it('rejects disabled users', async () => {
    const { service, repository } = await createService();
    await repository.updateUserStatus('user_admin', 'disabled');

    await expect(
      service.login({ username: 'admin', password: 'admin-password', remember: false })
    ).rejects.toMatchObject({
      code: 'account_disabled'
    });
  });

  it('maps invalid credentials to a client auth error instead of an internal error', async () => {
    const { service } = await createService();

    await expect(service.login({ username: 'admin', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'invalid_credentials',
      httpStatus: 401
    });
    await expect(service.login({ username: 'admin', password: 'wrong-password' })).rejects.toBeInstanceOf(
      IdentityServiceError
    );
  });

  it('stores password hashes through the identity password provider boundary', async () => {
    const { repository } = await createService();
    const user = await repository.findUserByUsername('admin');

    expect(user?.passwordHash.startsWith('identity-scrypt$1$')).toBe(true);
  });
});
