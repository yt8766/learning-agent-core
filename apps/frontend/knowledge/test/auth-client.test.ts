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
      baseUrl: '/api/knowledge/v1',
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
    const client = new AuthClient({ baseUrl: '/api/knowledge/v1' });

    await client.login({ email: 'dev@example.com', password: 'secret' });

    expect(fetcher).toHaveBeenCalledWith('/api/knowledge/v1/auth/login', expect.objectContaining({ method: 'POST' }));
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
      baseUrl: '/api/knowledge/v1',
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

  it('clears tokens when logout is called', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const client = new AuthClient({ baseUrl: '/api/knowledge/v1' });

    client.logout();

    expect(readTokens()).toBeUndefined();
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
      baseUrl: '/api/knowledge/v1',
      fetcher: async () => new Response(JSON.stringify({ message: 'refresh expired' }), { status: 401 }),
      onAuthLost
    });

    await expect(client.refreshTokensOnce()).rejects.toThrow('refresh expired');

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
      baseUrl: '/api/knowledge/v1',
      fetcher: async (url, init) => {
        const authorization = new Headers(init?.headers).get('Authorization') ?? undefined;
        calls.push({ url: String(url), authorization });
        if (String(url).endsWith('/auth/me') && authorization === 'Bearer old') {
          return new Response(JSON.stringify({ code: 'auth_token_expired', message: 'expired' }), { status: 401 });
        }
        if (String(url).endsWith('/auth/refresh')) {
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
    expect(calls.some(call => call.url.endsWith('/auth/refresh'))).toBe(true);
    expect(calls.at(-1)?.authorization).toBe('Bearer new');
  });

  it('rejects malformed login responses with a stable error', async () => {
    const client = new AuthClient({
      baseUrl: '/api/knowledge/v1',
      fetcher: async () => new Response(JSON.stringify({}), { status: 200 })
    });

    await expect(client.login({ email: 'dev@example.com', password: 'secret' })).rejects.toThrow(
      'Invalid auth response'
    );

    expect(readTokens()).toBeUndefined();
  });
});
