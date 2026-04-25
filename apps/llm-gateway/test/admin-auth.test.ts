import { describe, expect, it } from 'vitest';
import { AdminAuthTokenPairSchema } from '../src/contracts/admin-auth.js';
import { createAdminAuthService } from '../src/auth/admin-auth.js';
import { createMemoryAdminAuthRepository } from '../src/repositories/admin-auth.js';

const now = new Date('2026-04-25T00:00:00.000Z');

async function createSeededAuthService() {
  const repository = createMemoryAdminAuthRepository();
  const service = createAdminAuthService({
    repository,
    jwtSecret: 'test-jwt-secret',
    now: () => now
  });

  await service.ensureOwnerPassword({
    password: 'correct-password',
    displayName: 'admin'
  });

  return { repository, service };
}

describe('admin auth service', () => {
  it('bootstraps the owner password before first login when configured', async () => {
    const repository = createMemoryAdminAuthRepository();
    const service = createAdminAuthService({
      repository,
      jwtSecret: 'test-jwt-secret',
      bootstrapPassword: 'bootstrap-password',
      now: () => now
    });

    const tokenPair = await service.login({ username: 'admin', password: 'bootstrap-password' });

    expect(tokenPair.principal).toMatchObject({
      role: 'owner',
      displayName: 'admin'
    });
    await expect(repository.findPasswordCredential(tokenPair.principal.id)).resolves.toMatchObject({
      principalId: tokenPair.principal.id
    });
  });

  it('does not bootstrap the owner with an env example placeholder password', async () => {
    const repository = createMemoryAdminAuthRepository();
    const service = createAdminAuthService({
      repository,
      jwtSecret: 'test-jwt-secret',
      bootstrapPassword: 'replace-with-local-admin-password',
      now: () => now
    });

    await expect(
      service.login({ username: 'admin', password: 'replace-with-local-admin-password' })
    ).rejects.toMatchObject({
      code: 'admin_auth_not_configured',
      status: 503
    });
    await expect(repository.findOwnerPrincipal()).resolves.toBeNull();
  });

  it('logs in the owner with a password and returns a schema-valid token pair', async () => {
    const { service } = await createSeededAuthService();

    const tokenPair = await service.login({ username: 'admin', password: 'correct-password' });

    expect(AdminAuthTokenPairSchema.parse(tokenPair).principal).toMatchObject({
      role: 'owner',
      displayName: 'admin',
      status: 'active',
      accessTokenVersion: 1,
      refreshTokenVersion: 1,
      lastLoginAt: now.toISOString()
    });
    expect(tokenPair.accessToken).not.toBe(tokenPair.refreshToken);
    expect(new Date(tokenPair.accessTokenExpiresAt).getTime()).toBeGreaterThan(now.getTime());
    expect(new Date(tokenPair.refreshTokenExpiresAt).getTime()).toBeGreaterThan(now.getTime());
  });

  it('refreshes only with a refresh token and rejects refresh tokens as bearer access', async () => {
    const { service } = await createSeededAuthService();
    const tokenPair = await service.login({ username: 'admin', password: 'correct-password' });

    const refreshed = await service.refresh({ refreshToken: tokenPair.refreshToken });

    expect(refreshed.principal.id).toBe(tokenPair.principal.id);
    await expect(service.requireAccessToken(`Bearer ${tokenPair.refreshToken}`)).rejects.toMatchObject({
      code: 'admin_access_token_invalid',
      status: 401
    });
  });

  it('returns a 403 admin_access_token_expired error for expired access tokens', async () => {
    const { service } = await createSeededAuthService();
    const tokenPair = await service.login({ username: 'admin', password: 'correct-password' });
    const laterService = createAdminAuthService({
      repository: service.repository,
      jwtSecret: 'test-jwt-secret',
      now: () => new Date(now.getTime() + 16 * 60 * 1000)
    });

    await expect(laterService.requireAccessToken(`Bearer ${tokenPair.accessToken}`)).rejects.toMatchObject({
      code: 'admin_access_token_expired',
      status: 403
    });
  });

  it('changes password by bumping both token versions and invalidating old tokens', async () => {
    const { service } = await createSeededAuthService();
    const tokenPair = await service.login({ username: 'admin', password: 'correct-password' });

    const changed = await service.changePassword({
      authorization: `Bearer ${tokenPair.accessToken}`,
      currentPassword: 'correct-password',
      newPassword: 'new-secret-password'
    });

    expect(changed.principal.accessTokenVersion).toBe(tokenPair.principal.accessTokenVersion + 1);
    expect(changed.principal.refreshTokenVersion).toBe(tokenPair.principal.refreshTokenVersion + 1);
    await expect(service.requireAccessToken(`Bearer ${tokenPair.accessToken}`)).rejects.toMatchObject({
      code: 'admin_access_token_invalid',
      status: 401
    });
    await expect(service.login({ username: 'admin', password: 'correct-password' })).rejects.toMatchObject({
      code: 'admin_login_invalid_password'
    });
    await expect(service.login({ username: 'admin', password: 'new-secret-password' })).resolves.toMatchObject({
      principal: { id: tokenPair.principal.id }
    });
  });

  it('rejects login when the username does not match the owner display name', async () => {
    const { service } = await createSeededAuthService();

    await expect(service.login({ username: 'not-admin', password: 'correct-password' })).rejects.toMatchObject({
      code: 'admin_login_invalid_account',
      status: 401
    });
  });
});
