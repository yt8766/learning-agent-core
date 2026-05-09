import { describe, expect, it, vi } from 'vitest';
import { PATH_METADATA } from '@nestjs/common/constants';

import { IdentityController } from '../../src/api/identity/identity.controller';

describe('identity canonical routes', () => {
  const createAuthService = () => ({
    login: vi.fn(async (body: unknown) => ({ route: 'login', body })),
    refresh: vi.fn(async (body: unknown) => ({ route: 'refresh', body })),
    logout: vi.fn(async (body: unknown) => ({ route: 'logout', body })),
    me: vi.fn(async (principal: unknown) => ({ route: 'me', principal }))
  });

  it('mounts only the canonical identity route prefix', () => {
    expect(Reflect.getMetadata(PATH_METADATA, IdentityController)).toBe('identity');
  });

  it('delegates login refresh logout and me to the identity auth service', async () => {
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
});
