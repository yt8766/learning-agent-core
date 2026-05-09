import { describe, expect, it } from 'vitest';
import { createGatewayAuthApi, getDefaultGatewayAuthApi, type GatewayAuthApi } from '../src/auth/auth-api';
import { refreshGatewayAuthSessionOnce } from '../src/auth/auth-session';
import { clearGatewayRefreshToken, readGatewayRefreshToken, writeGatewayRefreshToken } from '../src/auth/auth-storage';
import viteConfig from '../vite.config';
class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
describe('agent gateway auth storage', () => {
  it('stores refresh tokens only in localStorage', () => {
    const storage = new MemoryStorage();
    writeGatewayRefreshToken('refresh', storage);
    expect(readGatewayRefreshToken(storage)).toBe('refresh');
    clearGatewayRefreshToken(storage);
    expect(readGatewayRefreshToken(storage)).toBeNull();
  });

  it('keeps the default auth api stable across provider renders', () => {
    expect(getDefaultGatewayAuthApi()).toBe(getDefaultGatewayAuthApi());
  });

  it('uses unified identity login and adapts the session for gateway views', async () => {
    const calls: Array<{ url?: string; method?: string }> = [];
    const requester = async (config: { url?: string; method?: string }) => {
      calls.push(config);
      if (config.url?.endsWith('/identity/login')) {
        return {
          status: 200,
          data: {
            account: {
              id: 'user_admin',
              username: 'admin',
              displayName: 'Admin',
              roles: ['admin'],
              status: 'enabled'
            },
            session: { id: 'sess_1', expiresAt: '2026-05-10T00:00:00.000Z' },
            tokens: {
              tokenType: 'Bearer',
              accessToken: 'identity-access',
              accessTokenExpiresAt: '2026-05-09T00:15:00.000Z',
              refreshToken: 'identity-refresh',
              refreshTokenExpiresAt: '2026-05-10T00:00:00.000Z'
            }
          }
        };
      }
      throw new Error('unexpected request');
    };
    const api = createGatewayAuthApi(undefined, requester);

    await expect(api.login('admin', 'admin-password')).resolves.toMatchObject({
      accessToken: 'identity-access',
      refreshToken: 'identity-refresh',
      session: { user: { username: 'admin', role: 'admin' } }
    });
    expect(calls[0]?.url).toBe('/api/identity/login');
    expect(calls[0]?.method).toBe('POST');
  });

  it('returns the rotated refresh token from unified identity refresh responses', async () => {
    const calls: Array<{ url?: string; method?: string; data?: unknown }> = [];
    const requester = async (config: { url?: string; method?: string; data?: unknown }) => {
      calls.push(config);
      if (config.url?.endsWith('/identity/refresh')) {
        return {
          status: 200,
          data: {
            tokens: {
              tokenType: 'Bearer',
              accessToken: 'new-access',
              accessTokenExpiresAt: '2026-05-09T00:15:00.000Z',
              refreshToken: 'new-refresh',
              refreshTokenExpiresAt: '2026-05-10T00:00:00.000Z'
            }
          }
        };
      }
      if (config.url?.endsWith('/identity/me')) {
        return {
          status: 200,
          data: {
            account: {
              id: 'user_admin',
              username: 'admin',
              displayName: 'Admin',
              roles: ['admin'],
              status: 'enabled'
            }
          }
        };
      }
      throw new Error('unexpected request');
    };
    const api = createGatewayAuthApi(undefined, requester);

    await expect(api.refresh('old-refresh')).resolves.toMatchObject({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      refreshTokenExpiresAt: '2026-05-10T00:00:00.000Z',
      refreshTokenStorage: 'localStorage',
      session: { user: { username: 'admin', role: 'admin' } }
    });
    expect(calls[0]).toMatchObject({
      url: '/api/identity/refresh',
      method: 'POST',
      data: { refreshToken: 'old-refresh' }
    });
  });

  it('shares concurrent refresh requests for the same refresh token', async () => {
    let refreshCalls = 0;
    const authApi: GatewayAuthApi = {
      login: async () => {
        throw new Error('login should not be called');
      },
      refresh: async () => {
        refreshCalls += 1;
        await Promise.resolve();
        return {
          accessToken: 'new-access',
          accessTokenExpiresAt: '2026-05-09T00:15:00.000Z',
          refreshToken: 'new-refresh',
          refreshTokenExpiresAt: '2026-05-10T00:00:00.000Z',
          refreshTokenStorage: 'localStorage',
          session: {
            issuedAt: '2026-05-09T00:00:00.000Z',
            user: { id: 'user_admin', username: 'admin', displayName: 'Admin', role: 'admin' }
          }
        };
      }
    };

    const [first, second] = await Promise.all([
      refreshGatewayAuthSessionOnce(authApi, 'old-refresh'),
      refreshGatewayAuthSessionOnce(authApi, 'old-refresh')
    ]);

    expect(first.refreshToken).toBe('new-refresh');
    expect(second.refreshToken).toBe('new-refresh');
    expect(refreshCalls).toBe(1);
  });

  it('uses the shared /api dev proxy for backend requests', () => {
    const proxy = viteConfig.server?.proxy;
    const proxyRecord = typeof proxy === 'object' && !Array.isArray(proxy) ? proxy : {};

    expect(proxyRecord['/api']).toMatchObject({
      target: expect.stringContaining('3000'),
      changeOrigin: true
    });
    expect(proxyRecord['/identity']).toBeUndefined();
    expect(proxyRecord['/agent-gateway']).toBeUndefined();
  });
});
