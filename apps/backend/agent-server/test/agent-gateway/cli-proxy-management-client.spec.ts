import { HttpException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CliProxyManagementClient } from '../../src/domains/agent-gateway/management/cli-proxy-management-client';

describe('CliProxyManagementClient', () => {
  it('normalizes management base url and sends bearer management key', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = new CliProxyManagementClient({
      apiBase: 'https://remote.router-for.me/v0/management/',
      managementKey: 'mgmt-secret',
      fetcher
    });

    await expect(client.checkConnection()).resolves.toMatchObject({
      status: 'connected',
      serverVersion: '1.2.3',
      serverBuildDate: '2026-05-08'
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://remote.router-for.me/v0/management/config',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ authorization: 'Bearer mgmt-secret' })
      })
    );
  });

  it('maps raw config yaml through the core contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      textResponse('debug: true\nrequest-retry: 2\n', {
        etag: 'config-v1'
      })
    );
    const client = createClient(fetcher);

    await expect(client.readRawConfig()).resolves.toEqual({
      content: 'debug: true\nrequest-retry: 2\n',
      format: 'yaml',
      version: 'config-v1'
    });

    expect(fetcher).toHaveBeenCalledWith(
      'https://remote.router-for.me/v0/management/config.yaml',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('masks raw api keys and never exposes vendor key fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        keys: [
          {
            key: 'sk-live-secret-one',
            name: 'Primary',
            disabled: false,
            created_at: '2026-05-08T00:00:00.000Z',
            usage: { requests: 7, last_request_at: '2026-05-08T00:01:00.000Z' }
          }
        ]
      })
    );
    const client = createClient(fetcher);

    await expect(client.listApiKeys()).resolves.toEqual({
      items: [
        {
          id: 'proxy-key-0',
          name: 'Primary',
          prefix: 'sk-***one',
          status: 'active',
          scopes: ['proxy:invoke'],
          createdAt: '2026-05-08T00:00:00.000Z',
          lastUsedAt: '2026-05-08T00:01:00.000Z',
          expiresAt: null,
          usage: { requestCount: 7, lastRequestAt: '2026-05-08T00:01:00.000Z' }
        }
      ]
    });
  });

  it('maps 401 responses to UnauthorizedException and other failures to HttpException', async () => {
    const unauthorized = createClient(vi.fn().mockResolvedValue(jsonResponse({ message: 'bad key' }, { status: 401 })));
    await expect(unauthorized.systemInfo()).rejects.toBeInstanceOf(UnauthorizedException);

    const upstreamFailure = createClient(
      vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'boom' } }, { status: 502 }))
    );
    await expect(upstreamFailure.discoverModels()).rejects.toBeInstanceOf(HttpException);
  });
});

function createClient(fetcher: typeof fetch): CliProxyManagementClient {
  return new CliProxyManagementClient({
    apiBase: 'https://remote.router-for.me/v0/management',
    managementKey: 'mgmt-secret',
    fetcher
  });
}

function jsonResponse(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}): Response {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
      'x-cli-proxy-version': '1.2.3',
      'x-cli-proxy-build-date': '2026-05-08',
      ...options.headers
    }),
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function textResponse(body: string, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => body
  } as Response;
}
