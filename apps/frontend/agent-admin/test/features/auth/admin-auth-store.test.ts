import type { AdminAccount, AdminTokenPair } from '@agent/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'agent-admin:auth';

describe('admin auth store', () => {
  beforeEach(() => {
    vi.resetModules();
    installLocalStorageMock();
  });

  it('persists the token pair in browser localStorage when remember login is enabled', async () => {
    const { adminAuthStore } = await import('@/features/auth/store/admin-auth-store');

    adminAuthStore.setAuthenticated(account(), tokenPair('access-1', 'refresh-1'), { persist: true });

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.account.username).toBe('admin');
    expect(stored.tokens.accessToken).toBe('access-1');
    expect(stored.tokens.refreshToken).toBe('refresh-1');
  });

  it('hydrates the token pair from browser localStorage on module load', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        account: account(),
        tokens: tokenPair('access-local', 'refresh-local')
      })
    );

    const { adminAuthStore } = await import('@/features/auth/store/admin-auth-store');

    expect(adminAuthStore.getSnapshot()).toEqual(
      expect.objectContaining({
        state: 'authenticated',
        accessToken: 'access-local',
        refreshToken: 'refresh-local'
      })
    );
  });

  it('updates persisted tokens after refresh rotation and clears them on logout or expiry', async () => {
    const { adminAuthStore } = await import('@/features/auth/store/admin-auth-store');

    adminAuthStore.setAuthenticated(account(), tokenPair('access-1', 'refresh-1'), { persist: true });
    adminAuthStore.setTokenPair(tokenPair('access-2', 'refresh-2'));

    const refreshed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(refreshed.tokens.accessToken).toBe('access-2');
    expect(refreshed.tokens.refreshToken).toBe('refresh-2');

    adminAuthStore.clear('expired');

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

function installLocalStorageMock() {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size;
    }
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
}

function account(): AdminAccount {
  return {
    id: 'admin_001',
    username: 'admin',
    displayName: '平台管理员',
    roles: ['super_admin'],
    status: 'enabled'
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
