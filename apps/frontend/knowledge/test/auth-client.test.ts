import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { clearTokens, readTokens, saveTokens } from '../src/api/token-storage';
import { installLocalStorageMock } from './local-storage-mock';

describe('AuthClient', () => {
  beforeEach(() => {
    installLocalStorageMock();
    clearTokens();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('logs in and stores tokens', async () => {
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher: async () =>
        new Response(
          JSON.stringify({
            user: { id: 'user_1', email: 'dev@example.com', roles: ['owner'], permissions: [] },
            tokens: {
              accessToken: 'access',
              refreshToken: 'refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        )
    });

    const session = await client.login({ email: 'dev@example.com', password: 'secret' });

    expect(session.user.email).toBe('dev@example.com');
    expect(readTokens()?.accessToken).toBe('access');
  });

  it('binds the default browser fetch before login requests', async () => {
    const fetcher = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            user: { id: 'user_1', email: 'dev@example.com', roles: ['owner'], permissions: [] },
            tokens: {
              accessToken: 'access',
              refreshToken: 'refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        )
      );
    }) as typeof fetch;
    vi.stubGlobal('fetch', fetcher);
    const client = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api' });

    await client.login({ email: 'dev@example.com', password: 'secret' });

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/identity/login',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shares concurrent refresh requests', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 1,
      refreshExpiresIn: 1209600
    });
    let refreshCalls = 0;
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher: async () => {
        refreshCalls += 1;
        return new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'new',
              refreshToken: 'new_refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        );
      }
    });

    await Promise.all([client.refreshTokensOnce(), client.refreshTokensOnce()]);

    expect(refreshCalls).toBe(1);
    expect(readTokens()?.accessToken).toBe('new');
  });

  it('calls unified identity logout and clears tokens when logout is called', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });

    await client.logout();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/logout');
    expect(readTokens()).toBeUndefined();
  });

  it('keeps an instance token cache until the client clears auth state', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const client = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api' });

    localStorage.clear();

    expect(client.getAccessToken()).toBe('access');
    client.clearTokens();
    expect(client.getAccessToken()).toBeNull();
  });

  it('clears tokens when refresh fails', async () => {
    const onAuthLost = vi.fn();
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 1,
      refreshExpiresIn: 1209600
    });
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher: async () => new Response(JSON.stringify({ message: 'refresh expired' }), { status: 401 }),
      onAuthLost
    });

    await expect(client.refreshTokensOnce()).rejects.toThrow('refresh expired');

    expect(readTokens()).toBeUndefined();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('rejects before protected API calls when the stored refresh token is expired', async () => {
    const onAuthLost = vi.fn();
    const fetcher = vi.fn<typeof fetch>();
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600,
      refreshTokenExpiresAt: '2026-04-30T00:00:00.000Z'
    });
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher,
      onAuthLost
    });

    await expect(client.ensureValidAccessToken()).rejects.toThrow('Refresh token expired');

    expect(fetcher).not.toHaveBeenCalled();
    expect(readTokens()).toBeUndefined();
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it('refreshes and retries current user once when the access token is expired server-side', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const calls: Array<{ url: string; authorization?: string }> = [];
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher: async (url, init) => {
        const authorization = new Headers(init?.headers).get('Authorization') ?? undefined;
        calls.push({ url: String(url), authorization });
        if (String(url).endsWith('/identity/me') && authorization === 'Bearer old') {
          return new Response(JSON.stringify({ code: 'auth_token_expired', message: 'expired' }), { status: 401 });
        }
        if (String(url).endsWith('/identity/refresh')) {
          return new Response(
            JSON.stringify({
              tokens: {
                accessToken: 'new',
                refreshToken: 'new_refresh',
                tokenType: 'Bearer',
                expiresIn: 7200,
                refreshExpiresIn: 1209600
              }
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            user: { id: 'user_1', email: 'dev@example.com', roles: ['owner'], permissions: [] }
          }),
          { status: 200 }
        );
      }
    });

    const user = await client.getCurrentUser();

    expect(user.email).toBe('dev@example.com');
    expect(calls.some(call => call.url.endsWith('/identity/refresh'))).toBe(true);
    expect(calls.at(-1)?.authorization).toBe('Bearer new');
  });

  it('rejects malformed login responses with a stable error', async () => {
    const client = new AuthClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetcher: async () => new Response(JSON.stringify({}), { status: 200 })
    });

    await expect(client.login({ email: 'dev@example.com', password: 'secret' })).rejects.toThrow(
      'Invalid auth response'
    );

    expect(readTokens()).toBeUndefined();
  });
});
