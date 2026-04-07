import { NotFoundException } from '@nestjs/common';

import type { ConfigureConnectorDto } from '@agent/shared';

import { buildConnectorsCenter } from '../centers/runtime-connectors-center';
import {
  configureConnectorWithGovernance,
  setConnectorEnabledWithGovernance
} from '../actions/runtime-connector-governance-actions';
import { registerConfiguredConnector, registerDiscoveredCapabilities } from '../helpers/runtime-connector-registry';
import { buildToolsCenter } from '../tools/runtime-tools-center';

export interface RuntimeToolsContext {
  settings: any;
  toolRegistry: any;
  orchestrator: any;
  runtimeStateRepository: any;
  mcpServerRegistry: any;
  mcpCapabilityRegistry: any;
  mcpClientManager: any;
  describeConnectorProfilePolicy: any;
  getConnectorRegistryContext: () => any;
}

export class RuntimeToolsService {
  constructor(private readonly getContext: () => RuntimeToolsContext) {}

  getToolsCenter() {
    const ctx = this.ctx();
    return buildToolsCenter({
      toolRegistry: ctx.toolRegistry,
      tasks: ctx.orchestrator.listTasks()
    });
  }

  async listConnectors() {
    return this.loadConnectorsCenter();
  }

  async createConnectorDraft(dto: Pick<ConfigureConnectorDto, 'templateId' | 'displayName'> & { actor?: string }) {
    return this.configureConnector({
      ...defaultConnectorConfig(dto.templateId),
      displayName: dto.displayName,
      actor: dto.actor ?? 'agent-chat-user',
      enabled: false
    });
  }

  async updateConnectorSecret(connectorId: string, apiKey: string, actor = 'agent-admin-user') {
    const ctx = this.ctx();
    const snapshot = await ctx.runtimeStateRepository.load();
    const configured = (snapshot.governance?.configuredConnectors ?? []).find(
      (item: any) => item.connectorId === connectorId
    );
    if (!configured) {
      throw new NotFoundException(`Connector ${connectorId} not configured`);
    }

    return this.configureConnector({
      templateId: configured.templateId,
      transport: configured.transport,
      displayName: configured.displayName,
      endpoint: configured.endpoint,
      command: configured.command,
      args: configured.args,
      apiKey,
      enabled: configured.enabled,
      actor
    });
  }

  async enableConnector(connectorId: string) {
    const ctx = this.ctx();
    await setConnectorEnabledWithGovernance({
      connectorId,
      enabled: true,
      profile: ctx.settings.profile,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpClientManager: ctx.mcpClientManager,
      describeConnectorProfilePolicy: ctx.describeConnectorProfilePolicy
    });
    return this.getConnector(connectorId);
  }

  async disableConnector(connectorId: string) {
    const ctx = this.ctx();
    await setConnectorEnabledWithGovernance({
      connectorId,
      enabled: false,
      profile: ctx.settings.profile,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpServerRegistry: ctx.mcpServerRegistry,
      mcpClientManager: ctx.mcpClientManager,
      describeConnectorProfilePolicy: ctx.describeConnectorProfilePolicy
    });
    return this.getConnector(connectorId);
  }

  async configureConnector(dto: ConfigureConnectorDto) {
    const ctx = this.ctx();
    return configureConnectorWithGovernance({
      dto,
      runtimeStateRepository: ctx.runtimeStateRepository,
      mcpClientManager: ctx.mcpClientManager,
      registerConfiguredConnector: (config: any) =>
        registerConfiguredConnector(ctx.getConnectorRegistryContext(), config),
      registerDiscoveredCapabilities: (id: string) =>
        registerDiscoveredCapabilities(ctx.getConnectorRegistryContext(), id),
      loadConnectorView: (id: string) => this.getConnector(id)
    });
  }

  async getConnector(connectorId: string) {
    const connectors = await this.loadConnectorsCenter();
    const connector = connectors.find((item: any) => item.id === connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    return connector;
  }

  private async loadConnectorsCenter() {
    const ctx = this.ctx();
    await ctx.mcpClientManager.sweepIdleSessions(ctx.settings.mcp.stdioSessionIdleTtlMs);
    await ctx.mcpClientManager.refreshAllServerDiscovery({ includeStdio: false }).catch(() => undefined);
    const snapshot = await ctx.runtimeStateRepository.load();
    const tasks = ctx.orchestrator.listTasks();
    return buildConnectorsCenter({
      profile: ctx.settings.profile,
      snapshot,
      tasks,
      connectors: ctx.mcpClientManager.describeServers()
    });
  }

  private ctx() {
    return this.getContext();
  }
}

function defaultConnectorConfig(
  templateId: ConfigureConnectorDto['templateId']
): Pick<ConfigureConnectorDto, 'templateId' | 'transport' | 'displayName' | 'command' | 'args'> {
  if (templateId === 'github-mcp-template') {
    return {
      templateId,
      transport: 'stdio',
      displayName: 'GitHub MCP',
      command: 'npx',
      args: ['-y', 'github-mcp-server']
    };
  }
  if (templateId === 'browser-mcp-template') {
    return {
      templateId,
      transport: 'stdio',
      displayName: 'Browser MCP',
      command: 'npx',
      args: ['-y', 'browserbase-mcp']
    };
  }
  return {
    templateId,
    transport: 'http',
    displayName: 'Lark MCP'
  };
}
