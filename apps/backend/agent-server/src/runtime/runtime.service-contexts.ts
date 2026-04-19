import { SkillCard, SkillSourceRecord } from '@agent/core';
import { describeConnectorProfilePolicy } from '@agent/runtime';

import { applyGovernanceOverrides, registerInstalledSkillWorker } from './helpers/runtime-connector-registry';
import { createCentersContext } from './domain/centers/runtime-centers-context';
import { createPlatformConsoleContext } from './domain/centers/runtime-platform-console-context';
import { createBackgroundRunnerContext } from './domain/background/runtime-background-context';
import { createConnectorRegistryContext } from './domain/connectors/runtime-connector-registry-context';
import { createKnowledgeContext } from './domain/knowledge/runtime-knowledge-context';
import { fetchProviderUsageAuditFromSettings } from './domain/metrics/runtime-provider-audit-context';
import { resolveTaskSkillSuggestions, syncInstalledSkillWorkers } from './runtime.service.helpers';
import { createSkillCatalogContext } from './domain/skills/runtime-skill-catalog-context';
import { createSkillInstallContext, createSkillSourcesContext } from './domain/skills/runtime-skill-contexts';
import { createTaskContext } from './domain/tasks/runtime-task-context';
import type { RuntimeBackgroundRunnerContext } from './helpers/runtime-background-runner';
import type { RuntimeSkillInstallContext } from './skills/runtime-skill-install.service';
import type { RuntimeSkillSourcesContext } from './skills/runtime-skill-sources.service';
import type { RuntimeHost } from './core/runtime.host';
import type { RuntimeCentersService } from './centers/runtime-centers.service';
import type { RuntimePlatformConsoleContext } from './centers/runtime-platform-console.records';
import type { RuntimeKnowledgeContext } from './services/runtime-knowledge.service';
import type { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
import type { RuntimeWenyuanFacade } from './wenyuan/runtime-wenyuan-facade';
import type { AppLoggerService } from '../logger/app-logger.service';

interface RuntimeServiceContextFactoryParams {
  settings: () => RuntimeHost['settings'];
  appLogger?: () => AppLoggerService | undefined;
  runtimeHost: () => RuntimeHost;
  skillRegistry: () => RuntimeHost['skillRegistry'];
  toolRegistry: () => RuntimeHost['toolRegistry'];
  llmProvider: () => RuntimeHost['llmProvider'];
  mcpServerRegistry: () => RuntimeHost['mcpServerRegistry'];
  mcpCapabilityRegistry: () => RuntimeHost['mcpCapabilityRegistry'];
  mcpClientManager: () => RuntimeHost['mcpClientManager'];
  orchestrator: () => RuntimeHost['orchestrator'];
  sessionCoordinator: () => RuntimeHost['sessionCoordinator'];
  runtimeStateRepository: () => RuntimeHost['runtimeStateRepository'];
  memoryRepository: () => RuntimeHost['memoryRepository'];
  ruleRepository: () => RuntimeHost['ruleRepository'];
  skillSourceSyncService: () => RuntimeHost['skillSourceSyncService'];
  skillArtifactFetcher: () => RuntimeHost['skillArtifactFetcher'];
  describeConnectorProfilePolicy: typeof describeConnectorProfilePolicy;
  operationalState: () => RuntimeOperationalStateService;
  wenyuanFacade: () => RuntimeWenyuanFacade;
  centersService: () => Pick<
    RuntimeCentersService,
    | 'getRuntimeCenter'
    | 'getRuntimeCenterSummary'
    | 'getApprovalsCenter'
    | 'getLearningCenter'
    | 'getLearningCenterSummary'
    | 'getEvalsCenter'
    | 'getEvalsCenterSummary'
    | 'getEvidenceCenter'
    | 'getToolsCenter'
    | 'getConnectorsCenter'
    | 'getSkillSourcesCenter'
    | 'getCompanyAgentsCenter'
  >;
  backgroundRunnerId: string;
  backgroundWorkerPoolSize: number;
  backgroundLeaseTtlMs: number;
  backgroundHeartbeatMs: number;
  backgroundPollMs: number;
}

export class RuntimeServiceContextFactory {
  constructor(private readonly params: RuntimeServiceContextFactoryParams) {}

  resolveTaskSkillSuggestions(goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) {
    return resolveTaskSkillSuggestions(() => this.getSkillSourcesContext(), goal, options);
  }

  getBackgroundWorkerSlots(): Map<string, { taskId: string; startedAt: string }> {
    return this.params.operationalState().getBackgroundWorkerSlots();
  }

  getConnectorRegistryContext() {
    return createConnectorRegistryContext({
      settings: this.params.settings,
      mcpServerRegistry: this.params.mcpServerRegistry,
      mcpCapabilityRegistry: this.params.mcpCapabilityRegistry,
      mcpClientManager: this.params.mcpClientManager,
      orchestrator: this.params.orchestrator
    });
  }

  getSkillInstallContext(): RuntimeSkillInstallContext {
    return createSkillInstallContext({
      settings: this.params.settings(),
      skillRegistry: this.params.skillRegistry(),
      skillArtifactFetcher: this.params.skillArtifactFetcher(),
      remoteSkillDiscoveryService: this.params.runtimeHost().remoteSkillDiscoveryService,
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    });
  }

  getSkillSourcesContext(): RuntimeSkillSourcesContext & {
    listSkillSources?: () => Promise<SkillSourceRecord[]>;
  } {
    return createSkillSourcesContext({
      settings: this.params.settings(),
      toolRegistry: this.params.toolRegistry(),
      skillRegistry: this.params.skillRegistry(),
      skillSourceSyncService: this.params.skillSourceSyncService(),
      remoteSkillDiscoveryService: this.params.runtimeHost().remoteSkillDiscoveryService,
      getDisabledSkillSourceIds: () => this.getDisabledSkillSourceIds(),
      getSkillInstallContext: () => this.getSkillInstallContext()
    });
  }

  getPlatformConsoleContext(): RuntimePlatformConsoleContext {
    const centersService = this.params.centersService();
    return createPlatformConsoleContext({
      skillRegistry: this.params.skillRegistry,
      orchestrator: this.params.orchestrator,
      sessionCoordinator: this.params.sessionCoordinator,
      centersService,
      getRuntimeCenter: centersService.getRuntimeCenter.bind(centersService),
      getRuntimeCenterSummary: centersService.getRuntimeCenterSummary.bind(centersService),
      getApprovalsCenter: centersService.getApprovalsCenter.bind(centersService),
      getLearningCenter: centersService.getLearningCenter.bind(centersService),
      getLearningCenterSummary: centersService.getLearningCenterSummary.bind(centersService),
      getEvalsCenter: centersService.getEvalsCenter.bind(centersService),
      getEvalsCenterSummary: centersService.getEvalsCenterSummary.bind(centersService),
      getEvidenceCenter: centersService.getEvidenceCenter.bind(centersService),
      getToolsCenter: centersService.getToolsCenter.bind(centersService),
      getConnectorsCenter: centersService.getConnectorsCenter.bind(centersService),
      getSkillSourcesCenter: centersService.getSkillSourcesCenter.bind(centersService),
      getCompanyAgentsCenter: centersService.getCompanyAgentsCenter.bind(centersService)
    });
  }

  getBackgroundRunnerContext(): RuntimeBackgroundRunnerContext {
    return createBackgroundRunnerContext({
      settings: this.params.settings,
      orchestrator: this.params.orchestrator,
      operationalState: this.params.operationalState,
      backgroundRunnerId: this.params.backgroundRunnerId,
      backgroundWorkerPoolSize: this.params.backgroundWorkerPoolSize,
      backgroundLeaseTtlMs: this.params.backgroundLeaseTtlMs,
      backgroundHeartbeatMs: this.params.backgroundHeartbeatMs,
      backgroundPollMs: this.params.backgroundPollMs
    });
  }

  async syncInstalledSkillWorkers(): Promise<void> {
    await syncInstalledSkillWorkers({
      skillRegistry: this.params.skillRegistry(),
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    });
  }

  async applyStoredGovernanceOverrides(): Promise<void> {
    const snapshot = await this.params.runtimeStateRepository().load();
    applyGovernanceOverrides(this.getConnectorRegistryContext(), snapshot);
  }

  async getDisabledSkillSourceIds(): Promise<string[]> {
    const snapshot = await this.params.runtimeStateRepository().load();
    return snapshot.governance?.disabledSkillSourceIds ?? [];
  }

  getKnowledgeContext(): RuntimeKnowledgeContext {
    return createKnowledgeContext({
      wenyuanFacade: this.params.wenyuanFacade,
      ruleRepository: this.params.ruleRepository,
      orchestrator: this.params.orchestrator,
      runtimeStateRepository: this.params.runtimeStateRepository
    });
  }

  getSkillCatalogContext() {
    return createSkillCatalogContext({
      skillRegistry: this.params.skillRegistry,
      llmProvider: this.params.llmProvider,
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    });
  }

  getTaskContext() {
    return createTaskContext({
      orchestrator: this.params.orchestrator,
      runtimeStateRepository: this.params.runtimeStateRepository,
      resolveTaskSkillSuggestions: (goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) =>
        this.resolveTaskSkillSuggestions(goal, options)
    });
  }

  getCentersContext() {
    return createCentersContext({
      settings: this.params.settings,
      appLogger: this.params.appLogger,
      wenyuanFacade: this.params.wenyuanFacade,
      sessionCoordinator: this.params.sessionCoordinator,
      orchestrator: this.params.orchestrator,
      runtimeStateRepository: this.params.runtimeStateRepository,
      memoryRepository: this.params.memoryRepository,
      ruleRepository: this.params.ruleRepository,
      skillRegistry: this.params.skillRegistry,
      toolRegistry: this.params.toolRegistry,
      mcpClientManager: this.params.mcpClientManager,
      mcpServerRegistry: this.params.mcpServerRegistry,
      mcpCapabilityRegistry: this.params.mcpCapabilityRegistry,
      describeConnectorProfilePolicy: this.params.describeConnectorProfilePolicy,
      fetchProviderUsageAudit: (days: number) => fetchProviderUsageAuditFromSettings(this.params.settings(), days),
      getBackgroundWorkerSlots: () => this.getBackgroundWorkerSlots(),
      getConnectorRegistryContext: () => this.getConnectorRegistryContext(),
      getSkillInstallContext: () => this.getSkillInstallContext(),
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      getPlatformConsoleContext: () => this.getPlatformConsoleContext()
    });
  }
}
