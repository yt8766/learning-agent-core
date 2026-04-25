import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN_AUTH_STORAGE_KEY,
  AdminClientAuthError,
  adminFetch,
  changeAdminPassword,
  clearStoredAdminAuth,
  getStoredAdminAuth,
  loginAdmin,
  logoutAdmin,
  setStoredAdminAuth,
  type AdminStoredAuth
} from '../src/auth/admin-client-auth.js';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const initialAuth: AdminStoredAuth = {
  principal: { id: 'admin', displayName: 'Admin' },
  accessToken: 'old-access',
  refreshToken: 'old-refresh',
  accessTokenExpiresAt: '2026-04-25T12:00:00.000Z',
  refreshTokenExpiresAt: '2026-04-26T12:00:00.000Z'
};

const refreshedAuth: AdminStoredAuth = {
  principal: { id: 'admin', displayName: 'Admin' },
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  accessTokenExpiresAt: '2026-04-25T13:00:00.000Z',
  refreshTokenExpiresAt: '2026-04-26T13:00:00.000Z'
};

function testNow(): Date {
  return new Date('2026-04-25T11:00:00.000Z');
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init
  });
}

describe('admin client auth', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('stores and clears the admin token pair under a shared key', () => {
    setStoredAdminAuth(initialAuth);

    expect(localStorage.getItem(ADMIN_AUTH_STORAGE_KEY)).toContain('old-access');
    expect(getStoredAdminAuth()).toEqual(initialAuth);

    clearStoredAdminAuth();

    expect(getStoredAdminAuth()).toBeNull();
  });

  it('adds the bearer access token to admin requests', async () => {
    setStoredAdminAuth(initialAuth);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, { status: 200 }));

    await adminFetch('/api/admin/models', undefined, { fetch: fetchMock, now: testNow });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/models',
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer old-access');
  });

  it('refreshes once for concurrent expired access tokens and replays each original request once', async () => {
    setStoredAdminAuth(initialAuth);
    let refreshCalls = 0;
    const seenProtectedAuthHeaders: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url === '/api/admin/auth/refresh') {
        refreshCalls += 1;
        expect(headers.get('authorization')).toBe('Bearer old-access');
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'old-refresh' });
        return jsonResponse(refreshedAuth, { status: 200 });
      }

      seenProtectedAuthHeaders.push(headers.get('authorization') ?? '');
      if (seenProtectedAuthHeaders.length <= 2) {
        return jsonResponse({ error: { code: 'admin_access_token_expired' } }, { status: 403 });
      }

      return jsonResponse({ ok: true, url }, { status: 200 });
    });

    const [first, second] = await Promise.all([
      adminFetch('/api/admin/a', undefined, { fetch: fetchMock, now: testNow }),
      adminFetch('/api/admin/b', undefined, { fetch: fetchMock, now: testNow })
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(seenProtectedAuthHeaders).toEqual([
      'Bearer old-access',
      'Bearer old-access',
      'Bearer new-access',
      'Bearer new-access'
    ]);
    expect(getStoredAdminAuth()).toEqual(refreshedAuth);
  });

  it('refreshes before an admin request when the access token expires within sixty seconds', async () => {
    setStoredAdminAuth({
      ...initialAuth,
      accessTokenExpiresAt: '2026-04-25T12:00:30.000Z'
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url === '/api/admin/auth/refresh') {
        expect(headers.get('authorization')).toBe('Bearer old-access');
        return jsonResponse(refreshedAuth, { status: 200 });
      }

      return jsonResponse({ ok: true, authorization: headers.get('authorization') }, { status: 200 });
    });

    const response = await adminFetch('/api/admin/models', undefined, {
      fetch: fetchMock,
      now: () => new Date('2026-04-25T12:00:00.000Z')
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      authorization: 'Bearer new-access'
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getStoredAdminAuth()).toEqual(refreshedAuth);
  });

  it('clears local auth when refresh fails and does not replay forever', async () => {
    setStoredAdminAuth(initialAuth);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/admin/auth/refresh') {
        return jsonResponse({ error: { code: 'invalid_refresh_token' } }, { status: 403 });
      }

      return jsonResponse({ error: { code: 'admin_access_token_expired' } }, { status: 403 });
    });

    const response = await adminFetch('/api/admin/a', undefined, { fetch: fetchMock });

    expect(response.status).toBe(403);
    expect(getStoredAdminAuth()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('posts username and password login, stores the returned token pair, and returns it', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(refreshedAuth, { status: 200 }));

    await expect(loginAdmin({ username: 'Owner', password: 'secret' }, { fetch: fetchMock })).resolves.toEqual(
      refreshedAuth
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ username: 'Owner', password: 'secret' })
      })
    );
    expect(getStoredAdminAuth()).toEqual(refreshedAuth);
  });

  it('preserves admin auth error codes when password login is rejected', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            code: 'admin_auth_not_configured',
            message: 'Admin owner credential is not configured.',
            type: 'admin_auth_error'
          }
        },
        { status: 503 }
      )
    );

    await expect(loginAdmin({ username: 'Owner', password: 'secret' }, { fetch: fetchMock })).rejects.toMatchObject({
      name: 'AdminClientAuthError',
      code: 'admin_auth_not_configured',
      status: 503
    });
    await expect(loginAdmin({ username: 'Owner', password: 'secret' }, { fetch: fetchMock })).rejects.toBeInstanceOf(
      AdminClientAuthError
    );
  });

  it('posts password changes through the authorized admin client', async () => {
    setStoredAdminAuth(initialAuth);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, { status: 200 }));

    await changeAdminPassword({ currentPassword: 'old', newPassword: 'new' }, { fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ currentPassword: 'old', newPassword: 'new' })
      })
    );
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer old-access');
  });

  it('posts logout and clears stored auth even when the endpoint rejects the token', async () => {
    setStoredAdminAuth(initialAuth);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: false }, { status: 403 }));

    await logoutAdmin({ fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers)
      })
    );
    expect(getStoredAdminAuth()).toBeNull();
  });
});
