import { describe, expect, it, vi } from 'vitest';

import { createAdminAuthApi } from '@/pages/auth/api/admin-auth.api';

describe('admin auth api paths', () => {
  it('uses unified identity endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          account: { id: 'u1', username: 'admin', roles: ['super_admin'], status: 'enabled' },
          tokens: { accessToken: 'a', refreshToken: 'r' }
        }),
        { status: 200 }
      )
    );
    const api = createAdminAuthApi({
      baseUrl: 'http://127.0.0.1:3000/api',
      fetchImpl: fetcher
    });

    await api.login({ username: 'admin', password: 'pw' });

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/login');
  });
});
