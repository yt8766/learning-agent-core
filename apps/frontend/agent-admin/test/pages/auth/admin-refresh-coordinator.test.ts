import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminRefreshCoordinator } from '@/pages/auth/runtime/admin-refresh-coordinator';

function createMockTokenManager() {
  return {
    getAccessToken: vi.fn().mockReturnValue('access-token'),
    getRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    setTokenPair: vi.fn(),
    clearTokens: vi.fn()
  };
}

describe('adminRefreshCoordinator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshes and stores tokens on success', async () => {
    const tokenManager = createMockTokenManager();
    const refreshRequest = vi.fn().mockResolvedValue({
      tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' }
    });
    const coordinator = createAdminRefreshCoordinator(tokenManager as any, refreshRequest);

    const result = await coordinator.refresh();

    expect(refreshRequest).toHaveBeenCalledWith('refresh-token');
    expect(tokenManager.setTokenPair).toHaveBeenCalledWith({
      accessToken: 'new-access',
      refreshToken: 'new-refresh'
    });
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('clears tokens on failure and rethrows', async () => {
    const tokenManager = createMockTokenManager();
    const error = new Error('refresh failed');
    const refreshRequest = vi.fn().mockRejectedValue(error);
    const coordinator = createAdminRefreshCoordinator(tokenManager as any, refreshRequest);

    await expect(coordinator.refresh()).rejects.toThrow('refresh failed');
    expect(tokenManager.clearTokens).toHaveBeenCalled();
  });

  it('deduplicates concurrent refresh calls', async () => {
    const tokenManager = createMockTokenManager();
    let resolveRefresh: (value: any) => void;
    const refreshRequest = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          resolveRefresh = resolve;
        })
    );
    const coordinator = createAdminRefreshCoordinator(tokenManager as any, refreshRequest);

    const first = coordinator.refresh();
    const second = coordinator.refresh();

    resolveRefresh!({ tokens: { accessToken: 'a', refreshToken: 'r' } });

    const [result1, result2] = await Promise.all([first, second]);

    expect(refreshRequest).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(result2).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('allows subsequent refresh after first completes', async () => {
    const tokenManager = createMockTokenManager();
    const refreshRequest = vi
      .fn()
      .mockResolvedValueOnce({ tokens: { accessToken: 'a1', refreshToken: 'r1' } })
      .mockResolvedValueOnce({ tokens: { accessToken: 'a2', refreshToken: 'r2' } });
    const coordinator = createAdminRefreshCoordinator(tokenManager as any, refreshRequest);

    await coordinator.refresh();
    await coordinator.refresh();

    expect(refreshRequest).toHaveBeenCalledTimes(2);
  });
});
