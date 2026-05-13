import { describe, expect, it } from 'vitest';
import type { AgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/agent-gateway-management-client';
import { AgentGatewayClientsController } from '../../src/api/agent-gateway/agent-gateway-clients.controller';
import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';
import { AgentGatewayClientApiKeyService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-api-key.service';
import { AgentGatewayClientQuotaService } from '../../src/domains/agent-gateway/clients/agent-gateway-client-quota.service';
import { AgentGatewayClientService } from '../../src/domains/agent-gateway/clients/agent-gateway-client.service';
import { MemoryAgentGatewayClientRepository } from '../../src/domains/agent-gateway/clients/memory-agent-gateway-client.repository';
import { MemoryAgentGatewayManagementClient } from '../../src/domains/agent-gateway/management/memory-agent-gateway-management-client';
import { CliProxyImportService } from '../../src/domains/agent-gateway/migration/cli-proxy-import.service';
import { AgentGatewayRuntimeAccountingService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-accounting.service';
import { AgentGatewayRuntimeAuthService } from '../../src/domains/agent-gateway/runtime/agent-gateway-runtime-auth.service';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';
import { MemoryAgentGatewayRepository } from '../../src/domains/agent-gateway/repositories/memory-agent-gateway.repository';

describe('agent gateway production migration smoke', () => {
  it('imports CLIProxyAPI metadata, configures a client key, invokes a model, and exposes usage and quota state', async () => {
    const gatewayRepository = new MemoryAgentGatewayRepository();
    const clientRepository = new MemoryAgentGatewayClientRepository(() => new Date('2026-05-11T00:00:00.000Z'));
    const migration = new CliProxyImportService(gatewayRepository, clientRepository, () => cliProxySource());

    const preview = await migration.preview({
      apiBase: 'https://cli-proxy.example.test',
      managementKey: 'mgmt-secret'
    });
    expect(preview.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'providerConfig', sourceId: 'codex', safe: true }),
        expect.objectContaining({ kind: 'authFile', sourceId: 'codex-auth.json', safe: true }),
        expect.objectContaining({ kind: 'quota', sourceId: 'codex-quota', safe: true }),
        expect.objectContaining({ kind: 'requestLog', sourceId: 'req-imported', safe: true })
      ])
    );

    const applied = await migration.apply({
      apiBase: 'https://cli-proxy.example.test',
      managementKey: 'mgmt-secret',
      selectedSourceIds: ['codex', 'codex-auth.json', 'codex-quota', 'req-imported']
    });
    expect(applied.failed).toEqual([]);
    expect(await gatewayRepository.listProviders()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'codex', modelFamilies: expect.arrayContaining(['codex-main']) })
      ])
    );
    expect(await gatewayRepository.listCredentialFiles()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'codex-auth.json', provider: 'codex', status: 'valid' })])
    );
    expect(await gatewayRepository.listQuotas()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'codex-quota', usedTokens: 120, limitTokens: 1000 })])
    );
    expect(await gatewayRepository.listLogs(10)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'req-imported', provider: 'codex' })])
    );

    const apiKeyService = new AgentGatewayClientApiKeyService(clientRepository, () => 'agp_live_smoke_secret');
    const clients = new AgentGatewayClientsController(
      new AgentGatewayClientService(clientRepository, () => new Date('2026-05-11T00:00:00.000Z')),
      apiKeyService,
      new AgentGatewayClientQuotaService(clientRepository, () => new Date('2026-05-11T00:00:00.000Z'))
    );
    const runtimeClient = await clients.createClient({ name: 'Migrated Runtime App', tags: ['migration-smoke'] });
    const key = await clients.createApiKey(runtimeClient.id, {
      name: 'OpenAI compatible',
      scopes: ['models.read', 'chat.completions']
    });
    await clients.updateQuota(runtimeClient.id, {
      tokenLimit: 1000,
      requestLimit: 10,
      resetAt: '2026-06-01T00:00:00.000Z'
    });

    const runtimeEngine = new RuntimeEngineFacade();
    const runtime = new AgentGatewayOpenAICompatibleController(
      new AgentGatewayRuntimeAuthService(clientRepository),
      runtimeEngine,
      new AgentGatewayRuntimeAccountingService(clientRepository, () => new Date('2026-05-11T00:00:00.000Z'))
    );

    await expect(runtime.models(`Bearer ${key.secret}`)).resolves.toMatchObject({
      object: 'list',
      data: [expect.objectContaining({ id: 'gpt-5.4' })]
    });
    const completion = await runtime.chatCompletions(`Bearer ${key.secret}`, {
      model: 'gpt-5.4',
      messages: [{ role: 'user', content: 'ping after migration' }]
    });
    expect(completion).toMatchObject({
      object: 'chat.completion',
      model: 'gpt-5.4',
      choices: [expect.objectContaining({ message: expect.objectContaining({ content: expect.any(String) }) })]
    });

    await expect(clients.usage(runtimeClient.id)).resolves.toMatchObject({ requestCount: 2, totalTokens: 13 });
    await expect(clients.logs(runtimeClient.id, '10')).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ endpoint: '/v1/models', statusCode: 200 }),
        expect.objectContaining({ endpoint: '/v1/chat/completions', model: 'gpt-5.4', providerId: 'codex' })
      ])
    });
    await expect(clients.quota(runtimeClient.id)).resolves.toMatchObject({
      clientId: runtimeClient.id,
      status: 'normal',
      usedRequests: 2,
      usedTokens: 13
    });
    await expect(runtimeEngine.health()).resolves.toMatchObject({
      status: 'ready',
      activeRequests: 0,
      activeStreams: 0,
      usageQueue: { pending: 1, failed: 0 },
      cooldowns: []
    });

    const managementClient = new MemoryAgentGatewayManagementClient();
    await managementClient.batchUploadAuthFiles({
      files: [
        {
          fileName: 'codex-auth.json',
          providerKind: 'codex',
          contentBase64: Buffer.from(
            JSON.stringify({
              status: 'valid',
              accountEmail: 'agent@example.com',
              models: ['gpt-5.4'],
              quota: {
                daily: {
                  limit: 1000,
                  used: 120,
                  resetAt: '2026-05-12T00:00:00.000Z'
                }
              }
            })
          ).toString('base64')
        }
      ]
    });
    await expect(managementClient.refreshQuotaDetails('codex')).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          providerId: 'codex',
          model: 'gpt-5.4',
          limit: 1000,
          used: 120,
          remaining: 880
        })
      ]
    });
  });
});

function cliProxySource(): AgentGatewayManagementClient {
  return {
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
            models: [{ name: 'gpt-5.4', alias: 'codex-main' }],
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
      return { items: [] };
    },
    async listQuotaDetails() {
      return {
        items: [
          {
            id: 'codex-quota',
            providerId: 'codex',
            model: 'gpt-5.4',
            scope: 'provider',
            window: 'daily',
            limit: 1000,
            used: 120,
            remaining: 880,
            resetAt: '2026-05-12T00:00:00.000Z',
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
            id: 'req-imported',
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
        modelAliases: [{ channel: 'default', sourceModel: 'gpt-5.4', alias: 'codex-main', fork: false }],
        updatedAt: '2026-05-11T00:00:00.000Z'
      };
    }
  } as AgentGatewayManagementClient;
}
