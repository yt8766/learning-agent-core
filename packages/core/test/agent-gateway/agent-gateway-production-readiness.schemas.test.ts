import { describe, expect, it } from 'vitest';

import {
  GatewayMigrationApplyResponseSchema,
  GatewayMigrationPreviewSchema,
  GatewayOAuthCredentialRecordSchema,
  GatewayProviderQuotaSnapshotSchema,
  GatewayRuntimeExecutorConfigSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway production readiness contracts', () => {
  it('parses runtime executor config without raw process or vendor leakage', () => {
    const config = GatewayRuntimeExecutorConfigSchema.parse({
      id: 'executor-openai',
      providerKind: 'openaiCompatible',
      enabled: true,
      adapterKind: 'process',
      commandProfile: 'openai-compatible-cli',
      baseUrl: 'https://api.example.com/v1',
      timeoutMs: 60000,
      concurrencyLimit: 4,
      modelAliases: { 'gpt-main': 'gpt-5.4' },
      secretRef: 'secret_provider_openai',
      updatedAt: '2026-05-11T00:00:00.000Z'
    });

    expect(config.providerKind).toBe('openaiCompatible');
    expect(JSON.stringify(config)).not.toContain('rawResponse');
    expect(JSON.stringify(config)).not.toContain('stderr');
  });

  it('parses OAuth credential records that expose only stable metadata and secret refs', () => {
    const credential = GatewayOAuthCredentialRecordSchema.parse({
      id: 'cred_codex_1',
      providerKind: 'codex',
      authFileId: 'codex-account.json',
      accountEmail: 'agent@example.com',
      projectId: 'agent-prod',
      status: 'valid',
      secretRef: 'secret_oauth_codex_1',
      scopes: ['openid', 'offline_access'],
      expiresAt: '2026-05-12T00:00:00.000Z',
      updatedAt: '2026-05-11T00:00:00.000Z',
      lastCheckedAt: '2026-05-11T00:00:00.000Z'
    });

    expect(credential.secretRef).toBe('secret_oauth_codex_1');
    expect(() =>
      GatewayOAuthCredentialRecordSchema.parse({
        ...credential,
        rawToken: 'should-not-parse'
      })
    ).toThrow();
  });

  it('parses provider quota snapshots by provider, account, and model scope', () => {
    const quota = GatewayProviderQuotaSnapshotSchema.parse({
      id: 'quota_codex_5h',
      providerKind: 'codex',
      authFileId: 'codex-account.json',
      accountEmail: 'agent@example.com',
      model: 'gpt-5-codex',
      scope: 'model',
      window: '5h',
      limit: 1000,
      used: 250,
      remaining: 750,
      resetAt: '2026-05-11T05:00:00.000Z',
      refreshedAt: '2026-05-11T00:00:00.000Z',
      status: 'normal',
      source: 'provider'
    });

    expect(quota.remaining).toBe(750);
  });

  it('parses migration preview and apply reports without accepting raw upstream payloads', () => {
    const preview = GatewayMigrationPreviewSchema.parse({
      source: {
        apiBase: 'http://localhost:8317/v0/management',
        serverVersion: 'cli-proxy-api',
        checkedAt: '2026-05-11T00:00:00.000Z'
      },
      resources: [
        {
          kind: 'authFile',
          sourceId: 'codex-account.json',
          targetId: 'codex-account.json',
          action: 'create',
          safe: true,
          summary: 'Import Codex OAuth auth file metadata'
        }
      ],
      conflicts: [],
      totals: {
        create: 1,
        update: 0,
        skip: 0,
        conflict: 0
      }
    });

    expect(preview.totals.create).toBe(1);
    expect(() =>
      GatewayMigrationPreviewSchema.parse({
        ...preview,
        rawResponse: { auth_files: [] }
      })
    ).toThrow();

    const apply = GatewayMigrationApplyResponseSchema.parse({
      migrationId: 'migration_1',
      appliedAt: '2026-05-11T00:01:00.000Z',
      imported: [{ kind: 'authFile', targetId: 'codex-account.json' }],
      skipped: [],
      failed: []
    });

    expect(apply.imported).toHaveLength(1);
  });

  it('rejects raw headers and secrets in production projections', () => {
    expect(() =>
      GatewayProviderQuotaSnapshotSchema.parse({
        id: 'quota_1',
        providerKind: 'claude',
        authFileId: 'claude.json',
        scope: 'account',
        window: 'daily',
        limit: 100,
        used: 1,
        remaining: 99,
        resetAt: null,
        refreshedAt: '2026-05-11T00:00:00.000Z',
        status: 'normal',
        source: 'provider',
        headers: { authorization: 'Bearer secret' }
      })
    ).toThrow();
  });
});
