import { describe, expect, it, vi } from 'vitest';
import { GatewayProviderQuotaSnapshotSchema } from '@agent/core';

import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import {
  SourceBackedProviderQuotaInspector,
  type ProviderQuotaSourceClient,
  type ProviderQuotaSourceRecord
} from '../../src/domains/agent-gateway/runtime-engine/accounting/provider-quota-source-client';

const refreshedAt = '2026-05-11T00:00:00.000Z';

describe('ProviderQuotaSourceClient adapter', () => {
  it('aggregates provider auth-file model windows without exposing raw vendor payloads', async () => {
    const source = createSourceClient([
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: 'daily',
        limit: 100,
        used: 25,
        resetAt: '2026-05-12T00:00:00.000Z',
        vendorPayload: { raw: 'must-not-leak' }
      },
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: 'daily',
        limit: 100,
        used: 30,
        resetAt: '2026-05-12T00:00:00.000Z'
      },
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: 'weekly',
        limit: 700,
        used: 200,
        resetAt: '2026-05-18T00:00:00.000Z'
      },
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: 'monthly',
        limit: 3000,
        used: 900,
        resetAt: '2026-06-01T00:00:00.000Z'
      },
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: 'rolling',
        limit: null,
        used: 11,
        resetAt: null
      },
      {
        providerKind: 'codex',
        authFileId: 'codex-auth.json',
        accountEmail: 'coder@example.com',
        model: 'gpt-5-codex',
        scope: 'model',
        window: '5h',
        limit: 50,
        used: 45,
        resetAt: '2026-05-11T05:00:00.000Z'
      }
    ]);
    const inspector = new SourceBackedProviderQuotaInspector('codex', source, { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [{ id: 'codex-auth.json', providerKind: 'codex', status: 'valid', models: ['gpt-5-codex'] }]
    });

    expect(source.fetchQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        providerKind: 'codex',
        authFile: expect.objectContaining({ id: 'codex-auth.json' })
      })
    );
    expect(snapshots).toHaveLength(5);
    expect(snapshots.find(item => item.window === 'daily')).toMatchObject({
      id: 'codex:codex-auth.json:gpt-5-codex:daily',
      limit: 100,
      used: 55,
      remaining: 45,
      source: 'provider',
      status: 'normal'
    });
    expect(snapshots.find(item => item.window === '5h')).toMatchObject({ status: 'warning' });
    expect(snapshots.find(item => item.window === 'rolling')).toMatchObject({
      limit: null,
      remaining: null,
      status: 'unknown'
    });
    expect(JSON.stringify(snapshots)).not.toContain('must-not-leak');
    snapshots.forEach(snapshot => expect(GatewayProviderQuotaSnapshotSchema.parse(snapshot)).toEqual(snapshot));
  });

  it('projects unreadable, expired, and forbidden provider responses as unknown snapshots', async () => {
    const source = createSourceClient([], { code: 'permission_denied', message: 'provider denied quota scope' });
    const inspector = new SourceBackedProviderQuotaInspector('codex', source, { now: () => refreshedAt });

    const snapshots = await inspector.inspect({
      authFiles: [
        { id: 'expired.json', providerKind: 'codex', status: 'expired', accountEmail: 'old@example.com' },
        { id: 'forbidden.json', providerKind: 'codex', status: 'valid', accountEmail: 'blocked@example.com' }
      ]
    });

    expect(source.fetchQuota).toHaveBeenCalledTimes(1);
    expect(snapshots).toEqual([
      expect.objectContaining({
        id: 'codex:expired.json:account:unknown',
        authFileId: 'expired.json',
        accountEmail: 'old@example.com',
        status: 'unknown',
        source: 'provider'
      }),
      expect.objectContaining({
        id: 'codex:forbidden.json:account:unknown',
        authFileId: 'forbidden.json',
        accountEmail: 'blocked@example.com',
        status: 'unknown',
        source: 'provider'
      })
    ]);
  });

  it('management refresh caches source-backed snapshots while preserving quota detail contract', async () => {
    const inspector = new SourceBackedProviderQuotaInspector(
      'codex',
      createSourceClient([
        {
          providerKind: 'codex',
          authFileId: 'codex-auth.json',
          accountEmail: 'coder@example.com',
          model: 'gpt-5-codex',
          scope: 'model',
          window: '5h',
          limit: 50,
          used: 10,
          resetAt: '2026-05-11T05:00:00.000Z'
        }
      ]),
      { now: () => refreshedAt }
    );
    const management = new MemoryAgentGatewayManagementClient({ quotaInspectors: [inspector] });
    await management.batchUploadAuthFiles({
      files: [
        {
          fileName: 'codex-auth.json',
          contentBase64: Buffer.from(
            JSON.stringify({ accountEmail: 'coder@example.com', models: ['gpt-5-codex'] })
          ).toString('base64')
        }
      ]
    });

    await expect(management.refreshQuotaDetails('codex')).resolves.toEqual({
      items: [
        {
          id: 'codex:codex-auth.json:gpt-5-codex:5h',
          providerId: 'codex',
          model: 'gpt-5-codex',
          scope: 'model',
          window: '5h',
          limit: 50,
          used: 10,
          remaining: 40,
          resetAt: '2026-05-11T05:00:00.000Z',
          refreshedAt,
          status: 'normal'
        }
      ]
    });
    await expect(management.listQuotaDetails()).resolves.toEqual({
      items: [expect.objectContaining({ id: 'codex:codex-auth.json:gpt-5-codex:5h' })]
    });
  });
});

function createSourceClient(
  records: ProviderQuotaSourceRecord[],
  error?: { code: 'unreadable' | 'account_expired' | 'permission_denied'; message: string }
): ProviderQuotaSourceClient & { fetchQuota: ReturnType<typeof vi.fn> } {
  return {
    fetchQuota: vi.fn().mockResolvedValue(error ? { status: 'error', error } : { status: 'ok', records })
  };
}
