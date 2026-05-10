import { Inject, Injectable } from '@nestjs/common';
import type { GatewayDashboardSummaryResponse, GatewayProviderKind } from '@agent/core';
import type { AgentGatewayManagementClient } from '../management/agent-gateway-management-client';
import { AGENT_GATEWAY_MANAGEMENT_CLIENT } from '../management/agent-gateway-management-client';
import type { AgentGatewayRepository } from '../repositories/agent-gateway.repository';
import { AGENT_GATEWAY_REPOSITORY } from '../repositories/agent-gateway.repository';

interface ProfileReadableManagementClient extends AgentGatewayManagementClient {
  profile?: { apiBase?: string };
}

@Injectable()
export class AgentGatewayDashboardService {
  constructor(
    @Inject(AGENT_GATEWAY_REPOSITORY) private readonly repository: AgentGatewayRepository,
    @Inject(AGENT_GATEWAY_MANAGEMENT_CLIENT) private readonly managementClient: AgentGatewayManagementClient
  ) {}

  async summary(): Promise<GatewayDashboardSummaryResponse> {
    const [config, providers, credentialFiles, apiKeys, connection, models] = await Promise.all([
      this.repository.getConfig(),
      this.repository.listProviders(),
      this.repository.listCredentialFiles(),
      this.managementClient.listApiKeys(),
      this.managementClient.checkConnection(),
      this.managementClient.discoverModels()
    ]);

    return {
      observedAt: new Date().toISOString(),
      connection: {
        status: connection.status,
        apiBase: readApiBase(this.managementClient),
        serverVersion: connection.serverVersion,
        serverBuildDate: connection.serverBuildDate
      },
      counts: {
        managementApiKeys: apiKeys.items.length,
        authFiles: credentialFiles.length,
        providerCredentials: providers.length,
        availableModels: models.groups.reduce((total, group) => total + group.models.length, 0)
      },
      providers: providers.map(provider => ({
        providerKind: inferProviderKind(provider.provider),
        configured: true,
        enabled: provider.status === 'disabled' ? 0 : 1,
        disabled: provider.status === 'disabled' ? 1 : 0,
        modelCount: provider.modelFamilies.length
      })),
      routing: {
        strategy: 'priority',
        forceModelPrefix: false,
        requestRetry: config.retryLimit,
        wsAuth: true,
        proxyUrl: null
      }
    };
  }
}

function readApiBase(client: AgentGatewayManagementClient): string | null {
  const apiBase = (client as ProfileReadableManagementClient).profile?.apiBase;
  return apiBase && URL.canParse(apiBase) ? apiBase : null;
}

function inferProviderKind(name: string): GatewayProviderKind {
  const normalized = name.toLowerCase();
  if (normalized.includes('gemini')) return 'gemini';
  if (normalized.includes('codex')) return 'codex';
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'claude';
  if (normalized.includes('vertex')) return 'vertex';
  if (normalized.includes('ampcode')) return 'ampcode';
  if (normalized.includes('openai')) return 'openai-compatible';
  return 'custom';
}
