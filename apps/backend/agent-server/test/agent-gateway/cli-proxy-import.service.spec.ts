import { describe, expect, it } from 'vitest';
import type { AgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { CliProxyImportService } from '../../src/domains/agent-gateway/migration/cli-proxy-import.service';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';

describe('CliProxyImportService', () => {
  it('previews normalized CLIProxyAPI resources and reports conflicts without mutating local state', async () => {
    const repository = new MemoryAgentGatewayRepository();
    await repository.upsertCredentialFile({
      id: 'codex-auth.json',
      provider: 'codex',
      path: '/local/codex-auth.json',
      status: 'valid',
      lastCheckedAt: '2026-05-10T00:00:00.000Z'
    });
    const credentialFilesBeforePreview = await repository.listCredentialFiles();
    const service = createService(repository);

    const preview = await service.preview({ apiBase: 'injected://cli-proxy', managementKey: 'mgmt-secret' });

    expect(preview.source).toMatchObject({
      apiBase: 'injected://cli-proxy',
      serverVersion: 'cli-proxy-1.2.3'
    });
    expect(preview.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'config', sourceId: 'config.yaml', action: 'update', safe: true }),
        expect.objectContaining({ kind: 'providerConfig', sourceId: 'codex', action: 'create', safe: true }),
        expect.objectContaining({ kind: 'authFile', sourceId: 'codex-auth.json', action: 'conflict', safe: false }),
        expect.objectContaining({ kind: 'apiKey', sourceId: 'proxy-key-1', action: 'conflict', safe: false }),
        expect.objectContaining({ kind: 'quota', sourceId: 'codex-quota', action: 'create', safe: true }),
        expect.objectContaining({ kind: 'requestLog', sourceId: 'req-1', action: 'create', safe: true })
      ])
    );
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'authFile', sourceId: 'codex-auth.json', resolution: 'skip' }),
        expect.objectContaining({ kind: 'apiKey', sourceId: 'proxy-key-1', resolution: 'manual' })
      ])
    );
    expect(await repository.listProviders()).toHaveLength(2);
    expect(await repository.listCredentialFiles()).toEqual(credentialFilesBeforePreview);
  });

  it('applies selected compatible resources and skips unsafe conflicts unless confirmed', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const clientRepository = new MemoryAgentGatewayClientRepository();
    await repository.upsertCredentialFile({
      id: 'codex-auth.json',
      provider: 'codex',
      path: '/local/codex-auth.json',
      status: 'valid',
      lastCheckedAt: '2026-05-10T00:00:00.000Z'
    });
    const service = createService(repository, clientRepository);

    const response = await service.apply({
      apiBase: 'injected://cli-proxy',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex', 'codex-auth.json', 'codex-quota', 'req-1', 'proxy-key-1']
    });

    expect(response.imported).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'providerConfig', targetId: 'codex' }),
        expect.objectContaining({ kind: 'quota', targetId: 'codex-quota' }),
        expect.objectContaining({ kind: 'requestLog', targetId: 'req-1' })
      ])
    );
    expect(response.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'authFile', sourceId: 'codex-auth.json' }),
        expect.objectContaining({ kind: 'apiKey', sourceId: 'proxy-key-1' })
      ])
    );
    expect(response.failed).toEqual([]);
    expect(response.warnings).toEqual(
      expect.arrayContaining([
        'authFile:codex-auth.json skipped because unsafe conflict requires confirmation',
        'apiKey:proxy-key-1 skipped because unsafe conflict requires confirmation'
      ])
    );
    expect(JSON.stringify(response)).not.toContain('mgmt-secret');
    expect(JSON.stringify(response)).not.toContain('/remote/codex-auth.json');
    expect(await repository.listProviders()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'codex', provider: 'Codex Production' })])
    );
    expect(await clientRepository.listClients()).toHaveLength(0);

    const confirmed = await service.apply({
      apiBase: 'injected://cli-proxy',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['proxy-key-1'],
      confirmUnsafeConflicts: true
    });

    expect(confirmed.imported).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'apiKey', targetId: 'proxy-key-1' })])
    );
    expect(await clientRepository.listClients()).toEqual([
      expect.objectContaining({ id: 'cli-proxy-import', name: 'Imported CLIProxyAPI clients' })
    ]);
    expect(await clientRepository.listApiKeys('cli-proxy-import')).toEqual([
      expect.objectContaining({ id: 'proxy-key-1', prefix: 'sk-***prod', status: 'disabled' })
    ]);
  });

  it('normalizes real CLIProxyAPI field drift and treats repeated confirmed key imports as idempotent skips', async () => {
    const repository = new MemoryAgentGatewayRepository();
    const clientRepository = new MemoryAgentGatewayClientRepository();
    const service = createService(repository, clientRepository, () => fieldDriftSourceClient());

    const preview = await service.preview({ apiBase: 'injected://cli-proxy', managementKey: 'mgmt-secret' });

    expect(preview.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'providerConfig',
          sourceId: 'codex',
          action: 'create',
          safe: true,
          summary: 'codex'
        }),
        expect.objectContaining({
          kind: 'apiKey',
          sourceId: 'proxy-key-raw',
          action: 'conflict',
          safe: false,
          summary: 'masked upstream key'
        }),
        expect.objectContaining({
          kind: 'requestLog',
          sourceId: 'request-log',
          action: 'create',
          safe: true
        })
      ])
    );

    const first = await service.apply({
      apiBase: 'injected://cli-proxy',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex', 'proxy-key-raw', 'request-log'],
      confirmUnsafeConflicts: true
    });
    const second = await service.apply({
      apiBase: 'injected://cli-proxy',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['proxy-key-raw'],
      confirmUnsafeConflicts: true
    });

    expect(first.failed).toEqual([]);
    expect(first.imported).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'apiKey' })]));
    expect(second.imported).not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'apiKey' })]));
    expect(second.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'apiKey',
          sourceId: 'proxy-key-raw',
          targetId: 'proxy-key-raw',
          reason: 'already imported'
        })
      ])
    );
    expect(await clientRepository.listApiKeys('cli-proxy-import')).toHaveLength(1);
    expect(await clientRepository.listApiKeys('cli-proxy-import')).toEqual([
      expect.objectContaining({ id: 'proxy-key-raw', prefix: 'sk-***raw', status: 'disabled' })
    ]);
  });
});

function createService(
  repository = new MemoryAgentGatewayRepository(),
  clientRepository = new MemoryAgentGatewayClientRepository(),
  sourceFactory: () => AgentGatewayManagementClient = () => fakeSourceClient()
): CliProxyImportService {
  return new CliProxyImportService(repository, clientRepository, sourceFactory);
}

function fakeSourceClient(): AgentGatewayManagementClient {
  const client: Partial<AgentGatewayManagementClient> = {
    async checkConnection() {
      return {
        status: 'connected',
        checkedAt: '2026-05-11T00:00:00.000Z',
        serverVersion: 'cli-proxy-1.2.3',
        serverBuildDate: '2026-05-10'
      };
    },
    async readRawConfig() {
      return { content: 'debug: true\nrequest-retry: 4\n', format: 'yaml', version: 'config-remote' };
    },
    async listProviderConfigs() {
      return {
        items: [
          {
            providerType: 'codex',
            id: 'codex',
            displayName: 'Codex Production',
            enabled: true,
            baseUrl: null,
            models: [{ name: 'gpt-5.1-codex', alias: 'codex-main' }],
            excludedModels: [],
            credentials: [{ credentialId: 'codex-cred', apiKeyMasked: 'sk-***prod', status: 'valid' }],
            rawSource: 'adapter'
          }
        ]
      };
    },
    async listAuthFiles() {
      return {
        items: [
          {
            id: 'codex-auth.json',
            providerId: 'codex',
            providerKind: 'codex',
            fileName: 'codex-auth.json',
            path: '/remote/codex-auth.json',
            status: 'valid',
            accountEmail: 'agent@example.com',
            projectId: null,
            modelCount: 1,
            updatedAt: '2026-05-11T00:00:00.000Z',
            metadata: { migrated: true }
          }
        ],
        nextCursor: null
      };
    },
    async listApiKeys() {
      return {
        items: [
          {
            id: 'proxy-key-1',
            name: 'Production proxy key',
            prefix: 'sk-***prod',
            status: 'active',
            scopes: ['proxy:invoke'],
            createdAt: '2026-05-11T00:00:00.000Z',
            lastUsedAt: null,
            expiresAt: null,
            usage: { requestCount: 7, lastRequestAt: null }
          }
        ]
      };
    },
    async listQuotaDetails() {
      return {
        items: [
          {
            id: 'codex-quota',
            providerId: 'codex',
            model: 'gpt-5.1-codex',
            scope: 'provider',
            window: 'daily',
            limit: 1000,
            used: 250,
            remaining: 750,
            resetAt: null,
            refreshedAt: '2026-05-11T00:00:00.000Z',
            status: 'normal'
          }
        ]
      };
    },
    async searchLogs() {
      return {
        items: [
          {
            id: 'req-1',
            occurredAt: '2026-05-11T00:00:00.000Z',
            method: 'POST',
            path: '/v1/chat/completions',
            statusCode: 200,
            durationMs: 123,
            managementTraffic: false,
            providerId: 'codex',
            apiKeyPrefix: 'sk-***prod',
            message: 'imported metadata only'
          }
        ],
        total: 1,
        nextCursor: null
      };
    },
    async listOAuthModelAliases(providerId: string) {
      return {
        providerId,
        modelAliases: [{ channel: 'default', sourceModel: 'gpt-5.1-codex', alias: 'codex-main', fork: false }],
        updatedAt: '2026-05-11T00:00:00.000Z'
      };
    }
  };
  return client as AgentGatewayManagementClient;
}

function fieldDriftSourceClient(): AgentGatewayManagementClient {
  const client = fakeSourceClient();
  return {
    ...client,
    async listProviderConfigs() {
      return {
        items: [
          {
            providerType: 'codex',
            id: 'codex',
            enabled: true,
            extraRuntimeField: 'ignored'
          } as never
        ]
      };
    },
    async listApiKeys() {
      return {
        items: [
          {
            id: 'proxy-key-raw',
            name: 'masked upstream key',
            maskedApiKey: 'sk-***raw',
            extraRuntimeField: 'ignored'
          } as never
        ]
      };
    },
    async searchLogs() {
      return {
        items: [
          {
            path: '/v1/chat/completions',
            status: 200,
            extraRuntimeField: 'ignored'
          } as never
        ],
        total: 1,
        nextCursor: null
      };
    }
  } as AgentGatewayManagementClient;
}
