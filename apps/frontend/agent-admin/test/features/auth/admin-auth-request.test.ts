import type { AdminTokenPair } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import { AdminAuthRequestError, createAdminAuthRequestRuntime } from '@/features/auth/runtime/admin-auth-request';
import type { AdminAuthTransport } from '@/features/auth/runtime/admin-auth-request';
import type { AdminRefreshCoordinator } from '@/features/auth/runtime/admin-refresh-coordinator';
import type { AdminTokenManager } from '@/features/auth/runtime/admin-token-manager';

describe('admin auth request runtime', () => {
  it('attaches access token to business requests', async () => {
    const transport = vi.fn(async () => ({ ok: true }));
    const runtime = createAdminAuthRequestRuntime(
      transport as unknown as AdminAuthTransport,
      createTokenManager('access-1', 'refresh-1'),
      createRefreshCoordinator()
    );

    await runtime.request('/platform/console');

    expect(transport).toHaveBeenCalledWith(
      '/platform/console',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-1'
        })
      })
    );
  });

  it('refreshes once and retries the original request after access token expiration', async () => {
    const transport = vi
      .fn()
      .mockRejectedValueOnce(new AdminAuthRequestError(401, 'access_token_expired', 'expired'))
      .mockResolvedValueOnce({ ok: true });
    const tokenManager = createTokenManager('access-1', 'refresh-1');
    const refresh = vi.fn(async () => tokenPair('access-2', 'refresh-2'));
    const runtime = createAdminAuthRequestRuntime(transport, tokenManager, { refresh });

    await expect(runtime.request('/runtime-center')).resolves.toEqual({ ok: true });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenLastCalledWith(
      '/runtime-center',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-2'
        }),
        retryAfterRefresh: true
      })
    );
  });

  it('does not recursively refresh skipped auth endpoints', async () => {
    const transport = vi.fn().mockRejectedValue(new AdminAuthRequestError(401, 'access_token_expired', 'expired'));
    const refresh = vi.fn(async () => tokenPair('access-2', 'refresh-2'));
    const runtime = createAdminAuthRequestRuntime(transport, createTokenManager('access-1', 'refresh-1'), { refresh });

    await expect(runtime.request('/admin/auth/refresh', { skipAuth: true })).rejects.toBeInstanceOf(
      AdminAuthRequestError
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

function createTokenManager(accessToken?: string, refreshToken?: string): AdminTokenManager {
  let tokens = tokenPair(accessToken ?? 'access', refreshToken ?? 'refresh');
  return {
    getAccessToken: () => tokens.accessToken,
    getRefreshToken: () => tokens.refreshToken,
    setTokenPair: nextTokens => {
      tokens = nextTokens;
    },
    clearTokens: () => {
      tokens = tokenPair('', '');
    }
  };
}

function createRefreshCoordinator(): AdminRefreshCoordinator {
  return {
    refresh: async () => tokenPair('access-2', 'refresh-2')
  };
}

function tokenPair(accessToken: string, refreshToken: string): AdminTokenPair {
  return {
    tokenType: 'Bearer',
    accessToken,
    accessTokenExpiresAt: '2026-04-30T12:15:00.000Z',
    refreshToken,
    refreshTokenExpiresAt: '2026-05-30T12:00:00.000Z'
  };
}
