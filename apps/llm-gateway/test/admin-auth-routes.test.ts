import { describe, expect, it } from 'vitest';
import { POST as changePassword } from '../app/api/admin/auth/change-password/route.js';
import { POST as login } from '../app/api/admin/auth/login/route.js';
import { POST as logout } from '../app/api/admin/auth/logout/route.js';
import { POST as refresh } from '../app/api/admin/auth/refresh/route.js';
import { createAdminAuthService, setAdminAuthServiceForRoutes } from '../src/auth/admin-auth.js';
import { createMemoryAdminAuthRepository } from '../src/repositories/admin-auth.js';

async function seedRoutes() {
  const service = createAdminAuthService({
    repository: createMemoryAdminAuthRepository(),
    jwtSecret: 'route-test-secret',
    now: () => new Date('2026-04-25T00:00:00.000Z')
  });
  await service.ensureOwnerPassword({ password: 'correct-password', displayName: 'Owner' });
  setAdminAuthServiceForRoutes(service);
  return service;
}

function jsonRequest(body: unknown, authorization?: string): Request {
  return new Request('http://localhost/api/admin/auth', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {})
    },
    body: JSON.stringify(body)
  });
}

describe('admin auth routes', () => {
  it('logs in, refreshes, changes password, and logs out using JSON bearer contracts', async () => {
    await seedRoutes();

    const loginResponse = await login(jsonRequest({ username: 'Owner', password: 'correct-password' }));
    const tokenPair = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(tokenPair.principal.role).toBe('owner');

    const refreshResponse = await refresh(jsonRequest({ refreshToken: tokenPair.refreshToken }));
    expect(refreshResponse.status).toBe(200);

    const changeResponse = await changePassword(
      jsonRequest(
        {
          currentPassword: 'correct-password',
          newPassword: 'new-secret-password'
        },
        `Bearer ${tokenPair.accessToken}`
      )
    );
    const changed = await changeResponse.json();

    expect(changeResponse.status).toBe(200);
    expect(changed.principal.accessTokenVersion).toBe(2);

    const logoutResponse = await logout(jsonRequest({}));
    expect(logoutResponse.status).toBe(200);
    await expect(logoutResponse.json()).resolves.toEqual({ ok: true });
  });

  it('maps an expired access token to 403 admin_access_token_expired', async () => {
    const service = await seedRoutes();
    const tokenPair = await service.login({ username: 'Owner', password: 'correct-password' });
    setAdminAuthServiceForRoutes(
      createAdminAuthService({
        repository: service.repository,
        jwtSecret: 'route-test-secret',
        now: () => new Date('2026-04-25T00:16:00.000Z')
      })
    );

    const response = await changePassword(
      jsonRequest(
        {
          currentPassword: 'correct-password',
          newPassword: 'new-secret-password'
        },
        `Bearer ${tokenPair.accessToken}`
      )
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('admin_access_token_expired');
  });
});
