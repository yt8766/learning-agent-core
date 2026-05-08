import { describe, expect, it, vi } from 'vitest';

import { IdentityController } from '../../src/api/identity/identity.controller';
import { LegacyAuthController } from '../../src/api/identity/legacy-auth.controller';

describe('identity route aliases', () => {
  const createAuthService = () => ({
    login: vi.fn(async (body: unknown) => ({ route: 'login', body })),
    refresh: vi.fn(async (body: unknown) => ({ route: 'refresh', body })),
    logout: vi.fn(async (body: unknown) => ({ route: 'logout', body })),
    me: vi.fn(async (principal: unknown) => ({ route: 'me', principal }))
  });

  it('serves canonical identity routes through the auth service shell', async () => {
    const authService = createAuthService();
    const controller = new IdentityController(authService as never);
    const loginBody = { username: 'admin', password: 'pw' };
    const refreshBody = { refreshToken: 'refresh-token' };
    const logoutBody = { refreshToken: 'refresh-token' };
    const principal = { sub: 'user-1' };

    await expect(controller.login(loginBody)).resolves.toMatchObject({ route: 'login' });
    await expect(controller.refresh(refreshBody)).resolves.toMatchObject({ route: 'refresh' });
    await expect(controller.logout(logoutBody)).resolves.toMatchObject({ route: 'logout' });
    await expect(controller.me({ principal })).resolves.toMatchObject({ route: 'me' });

    expect(authService.login).toHaveBeenCalledWith(loginBody);
    expect(authService.refresh).toHaveBeenCalledWith(refreshBody);
    expect(authService.logout).toHaveBeenCalledWith(logoutBody);
    expect(authService.me).toHaveBeenCalledWith(principal);
  });

  it('serves legacy auth routes through the same auth service shell', async () => {
    const authService = createAuthService();
    const controller = new LegacyAuthController(authService as never);
    const loginBody = { username: 'admin', password: 'pw' };
    const refreshBody = { refreshToken: 'refresh-token' };
    const logoutBody = { refreshToken: 'refresh-token' };

    await expect(controller.login(loginBody)).resolves.toMatchObject({ route: 'login' });
    await expect(controller.refresh(refreshBody)).resolves.toMatchObject({ route: 'refresh' });
    await expect(controller.logout(logoutBody)).resolves.toMatchObject({ route: 'logout' });

    expect(authService.login).toHaveBeenCalledWith(loginBody);
    expect(authService.refresh).toHaveBeenCalledWith(refreshBody);
    expect(authService.logout).toHaveBeenCalledWith(logoutBody);
  });
});
