import { describe, expect, it } from 'vitest';

import { AdminAuthError } from '../../src/admin-auth/admin-auth.errors';
import { createDefaultAdminAuthFixtures } from '../../src/admin-auth/admin-auth-fixtures';
import { defaultAdminAuthPolicy } from '../../src/admin-auth/admin-auth-policy';
import { AdminAuthService } from '../../src/admin-auth/admin-auth.service';
import { AdminJwtProvider } from '../../src/admin-auth/admin-jwt.provider';
import { PasswordHasherProvider } from '../../src/admin-auth/password-hasher.provider';
import { AdminAuthMemoryRepository } from '../../src/admin-auth/repositories/admin-auth-memory.repository';

describe('AdminAuthService', () => {
  it('logs in with username and password and returns account session and token pair', async () => {
    const service = await createService();

    const response = await service.login({
      username: 'admin',
      password: 'rust123@',
      remember: true
    });

    expect(response.account).toEqual(
      expect.objectContaining({
        username: 'admin',
        displayName: '平台管理员',
        roles: ['super_admin'],
        status: 'enabled'
      })
    );
    expect(response.session.id).toMatch(/^admin_sess_/);
    expect(response.tokens.tokenType).toBe('Bearer');
    expect(response.tokens.accessToken).toEqual(expect.any(String));
    expect(response.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('returns invalid_credentials for unknown accounts and wrong passwords', async () => {
    const service = await createService();

    await expectAuthError(
      () =>
        service.login({
          username: 'missing',
          password: 'rust123@'
        }),
      'invalid_credentials'
    );
    await expectAuthError(
      () =>
        service.login({
          username: 'admin',
          password: 'wrong-password'
        }),
      'invalid_credentials'
    );
  });

  it('locks an account after repeated password failures', async () => {
    const service = await createService({
      maxFailedLoginAttempts: 2,
      lockDurationSeconds: 900
    });

    await expectAuthError(
      () => service.login({ username: 'developer', password: 'wrong-password' }),
      'invalid_credentials'
    );
    await expectAuthError(() => service.login({ username: 'developer', password: 'wrong-password' }), 'account_locked');
    await expectAuthError(
      () => service.login({ username: 'developer', password: 'developer-password-123' }),
      'account_locked'
    );
  });

  it('rotates refresh tokens and revokes the session when a used token is replayed', async () => {
    const service = await createService();
    const login = await service.login({
      username: 'admin',
      password: 'rust123@'
    });

    const refreshed = await service.refresh({
      refreshToken: login.tokens.refreshToken
    });

    expect(refreshed.tokens.refreshToken).not.toBe(login.tokens.refreshToken);
    await expectAuthError(
      () =>
        service.refresh({
          refreshToken: login.tokens.refreshToken
        }),
      'session_revoked'
    );
    await expectAuthError(
      () =>
        service.refresh({
          refreshToken: refreshed.tokens.refreshToken
        }),
      'session_revoked'
    );
  });

  it('logs out idempotently and rejects me after session revoke', async () => {
    const service = await createService();
    const login = await service.login({
      username: 'developer',
      password: 'developer-password-123'
    });
    const principal = await service.verifyAccessToken(login.tokens.accessToken);

    expect((await service.getMe(principal)).account.username).toBe('developer');
    expect(await service.logout({ refreshToken: login.tokens.refreshToken }, principal)).toEqual({
      success: true
    });
    expect(await service.logout({ refreshToken: login.tokens.refreshToken }, principal)).toEqual({
      success: true
    });
    await expectAuthError(() => service.getMe(principal), 'session_revoked');
  });
});

async function createService(policyOverrides: Partial<typeof defaultAdminAuthPolicy> = {}) {
  const passwordHasher = new PasswordHasherProvider();
  const repository = new AdminAuthMemoryRepository(
    await createDefaultAdminAuthFixtures(passwordHasher),
    () => new Date('2026-04-30T12:00:00.000Z')
  );
  return new AdminAuthService(
    repository,
    new AdminJwtProvider('test-admin-auth-secret'),
    passwordHasher,
    {
      ...defaultAdminAuthPolicy,
      ...policyOverrides
    },
    () => new Date('2026-04-30T12:00:00.000Z')
  );
}

async function expectAuthError(action: () => Promise<unknown>, code: AdminAuthError['code']): Promise<void> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(AdminAuthError);
    expect((error as AdminAuthError).code).toBe(code);
    return;
  }

  throw new Error(`Expected AdminAuthError ${code}`);
}
