import { describe, expect, it, vi } from 'vitest';

import { createAuthServiceClient } from '@/pages/identity/api/auth-service-client';

describe('auth service client paths', () => {
  it('uses unified identity users endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          users: []
        }),
        { status: 200 }
      )
    );
    const client = createAuthServiceClient({
      baseUrl: 'http://127.0.0.1:3000/api',
      getAccessToken: () => 'access-token',
      fetchImpl: fetcher
    });

    await client.listUsers();

    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:3000/api/identity/users');
  });
});
