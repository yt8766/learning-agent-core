import { describe, expect, it, vi } from 'vitest';

import { AdminAuthController } from '../../src/admin-auth/admin-auth.controller';

describe('AdminAuthController', () => {
  const createController = () => {
    const service = {
      login: vi.fn().mockResolvedValue({
        account: { id: 'a-1', username: 'admin', displayName: 'Admin', roles: ['super_admin'], status: 'enabled' },
        session: { id: 's-1', expiresAt: '2026-06-01T00:00:00.000Z' },
        tokens: { tokenType: 'Bearer', accessToken: 'at', refreshToken: 'rt' }
      }),
      refresh: vi.fn().mockResolvedValue({ tokens: { tokenType: 'Bearer', accessToken: 'at2', refreshToken: 'rt2' } }),
      logout: vi.fn().mockResolvedValue({ success: true }),
      getMe: vi.fn().mockResolvedValue({
        account: { id: 'a-1', username: 'admin', displayName: 'Admin', roles: ['super_admin'], status: 'enabled' }
      })
    };
    return { controller: new AdminAuthController(service as never), service };
  };

  it('login delegates to service', async () => {
    const { controller, service } = createController();

    const result = await controller.login({ username: 'admin', password: 'pass' });

    expect(result.account.username).toBe('admin');
    expect(service.login).toHaveBeenCalledWith({ username: 'admin', password: 'pass' });
  });

  it('refresh delegates to service', async () => {
    const { controller, service } = createController();

    const result = await controller.refresh({ refreshToken: 'rt' });

    expect(result.tokens.accessToken).toBe('at2');
    expect(service.refresh).toHaveBeenCalledWith({ refreshToken: 'rt' });
  });

  it('logout delegates to service', async () => {
    const { controller, service } = createController();

    const result = await controller.logout({ refreshToken: 'rt' });

    expect(result).toEqual({ success: true });
    expect(service.logout).toHaveBeenCalledWith({ refreshToken: 'rt' }, undefined);
  });

  it('me delegates to service with principal from request', async () => {
    const { controller, service } = createController();
    const principal = { accountId: 'a-1', username: 'admin', sessionId: 's-1' };
    const request = { adminPrincipal: principal };

    const result = await controller.me(request as never);

    expect(result.account.username).toBe('admin');
    expect(service.getMe).toHaveBeenCalledWith(principal);
  });
});
