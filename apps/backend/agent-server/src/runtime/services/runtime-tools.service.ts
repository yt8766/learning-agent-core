import { NotFoundException } from '@nestjs/common';

import type { ConfigureConnectorDto, ConfiguredConnectorRecord } from '@agent/core';
import { describeConnectorProfilePolicy } from '@agent/runtime';

import type { RuntimeHost } from '../core/runtime.host';
import type { PlatformConsoleConnectorsRecord } from '../centers/runtime-platform-console.records';
import {
  configureConnectorWithGovernance,
  setConnectorEnabledWithGovernance
} from '../actions/runtime-connector-governance-actions';
import {
  buildConnectorDraftConfig,
  buildConnectorSecretUpdateConfig,
  findConfiguredConnector
} from '../domain/tools/runtime-connector-drafts';
import { loadConnectorsCenterForTools } from '../domain/tools/runtime-connectors-reader';
import { registerConfiguredConnector, registerDiscoveredCapabilities } from '../helpers/runtime-connector-registry';
import { buildToolsCenter } from '../tools/runtime-tools-center';

export interface RuntimeToolsContext {
  settings: RuntimeHost['settings'];
  toolRegistry: RuntimeHost['toolRegistry'];
  orchestrator: RuntimeHost['orchestrator'];
  runtimeStateRepository: RuntimeHost['runtimeStateRepository'];
  mcpServerRegistry: RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: RuntimeHost['mcpCapabilityRegistry'];
  mcpClientManager: RuntimeHost['mcpClientManager'];
  describeConnectorProfilePolicy: typeof describeConnectorProfilePolicy;
  getConnectorRegistryContext: () => {
    settings: RuntimeHost['settings'];
    mcpServerRegistry: RuntimeHost['mcpServerRegistry'];
    mcpCapabilityRegistry: RuntimeHost['mcpCapabilityRegistry'];
    mcpClientManager: RuntimeHost['mcpClientManager'];
    orchestrator: RuntimeHost['orchestrator'];
  };
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
    return this.configureConnector(buildConnectorDraftConfig(dto));
  }

  async updateConnectorSecret(connectorId: string, apiKey: string, actor = 'agent-admin-user') {
    const ctx = this.ctx();
    const snapshot = await ctx.runtimeStateRepository.load();
    const configured = findConfiguredConnector(snapshot.governance?.configuredConnectors ?? [], connectorId);
    if (!configured) {
      throw new NotFoundException(`Connector ${connectorId} not configured`);
    }

    return this.configureConnector(buildConnectorSecretUpdateConfig(configured, apiKey, actor));
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
      registerConfiguredConnector: (config: ConfiguredConnectorRecord) =>
        registerConfiguredConnector(ctx.getConnectorRegistryContext(), config),
      registerDiscoveredCapabilities: (id: string) =>
        registerDiscoveredCapabilities(ctx.getConnectorRegistryContext(), id),
      loadConnectorView: (id: string) => this.getConnector(id)
    });
  }

  async getConnector(connectorId: string) {
    const connectors = await this.loadConnectorsCenter();
    const connector = connectors.find(item => item.id === connectorId);
    if (!connector) {
      throw new NotFoundException(`Connector ${connectorId} not found`);
    }
    return connector;
  }

  private async loadConnectorsCenter(): Promise<PlatformConsoleConnectorsRecord> {
    return loadConnectorsCenterForTools(this.ctx());
  }

  private ctx() {
    return this.getContext();
  }
}
