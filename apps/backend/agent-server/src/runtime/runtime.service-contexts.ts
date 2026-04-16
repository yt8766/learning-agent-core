import { SkillCard } from '@agent/shared';

import { applyGovernanceOverrides, registerInstalledSkillWorker } from './helpers/runtime-connector-registry';
import {
  fetchProviderUsageAudit,
  type ProviderAuditSyncResult
} from '../modules/runtime-metrics/services/provider-audit';
import {
  createSkillInstallContext,
  createSkillSourcesContext,
  resolveTaskSkillSuggestions,
  syncInstalledSkillWorkers
} from './runtime.service.helpers';
import type { RuntimeBackgroundRunnerContext } from './helpers/runtime-background-runner';
import type { RuntimeSkillInstallContext } from './skills/runtime-skill-install.service';
import type { RuntimeSkillSourcesContext } from './skills/runtime-skill-sources.service';
import type { RuntimeHost } from './core/runtime.host';
import type { RuntimeCentersService } from './centers/runtime-centers.service';
import type { RuntimeKnowledgeContext } from './services/runtime-knowledge.service';
import type { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
import type { RuntimeWenyuanFacade } from './wenyuan/runtime-wenyuan-facade';

interface RuntimeServiceContextFactoryParams {
  settings: () => RuntimeHost['settings'];
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
  describeConnectorProfilePolicy: (connectorId: string, profile: string) => unknown;
  operationalState: () => RuntimeOperationalStateService;
  centersService: () => RuntimeCentersService;
  wenyuanFacade: () => RuntimeWenyuanFacade;
  getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => unknown | Promise<unknown>;
  getApprovalsCenter: (filters?: Record<string, unknown>) => unknown | Promise<unknown>;
  getLearningCenter: () => unknown | Promise<unknown>;
  getEvalsCenter: (days?: number, filters?: Record<string, unknown>) => unknown | Promise<unknown>;
  getEvidenceCenter: () => unknown | Promise<unknown>;
  getConnectorsCenter: () => unknown | Promise<unknown>;
  getSkillSourcesCenter: () => unknown | Promise<unknown>;
  getCompanyAgentsCenter: () => unknown | Promise<unknown>;
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
    return {
      settings: this.params.settings(),
      mcpServerRegistry: this.params.mcpServerRegistry(),
      mcpCapabilityRegistry: this.params.mcpCapabilityRegistry(),
      mcpClientManager: this.params.mcpClientManager(),
      orchestrator: this.params.orchestrator()
    };
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
    listSkillSources?: () => Promise<unknown[]>;
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

  getPlatformConsoleContext() {
    return {
      skillRegistry: this.params.skillRegistry(),
      orchestrator: this.params.orchestrator(),
      sessionCoordinator: this.params.sessionCoordinator(),
      getRuntimeCenter: this.params.getRuntimeCenter,
      getApprovalsCenter: this.params.getApprovalsCenter,
      getLearningCenter: this.params.getLearningCenter,
      getEvalsCenter: this.params.getEvalsCenter,
      getEvidenceCenter: this.params.getEvidenceCenter,
      getConnectorsCenter: this.params.getConnectorsCenter,
      getSkillSourcesCenter: this.params.getSkillSourcesCenter,
      getCompanyAgentsCenter: this.params.getCompanyAgentsCenter
    };
  }

  async fetchProviderUsageAudit(days: number): Promise<ProviderAuditSyncResult> {
    return fetchProviderUsageAudit(
      this.params.settings().providerAudit.adapters,
      this.params.settings().providerAudit.primaryProvider,
      days
    );
  }

  getBackgroundRunnerContext(): RuntimeBackgroundRunnerContext {
    return {
      enabled: this.params.settings().runtimeBackground.enabled,
      orchestrator: this.params.orchestrator(),
      runnerId: this.params.backgroundRunnerId,
      workerPoolSize: this.params.backgroundWorkerPoolSize,
      leaseTtlMs: this.params.backgroundLeaseTtlMs,
      heartbeatMs: this.params.backgroundHeartbeatMs,
      pollMs: this.params.backgroundPollMs,
      backgroundWorkerSlots: this.params.operationalState().getBackgroundWorkerSlots(),
      isSweepInFlight: () => this.params.operationalState().isBackgroundRunnerSweepInFlight(),
      setSweepInFlight: value => this.params.operationalState().setBackgroundRunnerSweepInFlight(value)
    };
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
    return {
      wenyuanFacade: this.params.wenyuanFacade(),
      ruleRepository: this.params.ruleRepository(),
      orchestrator: this.params.orchestrator(),
      runtimeStateRepository: this.params.runtimeStateRepository()
    };
  }

  getSkillCatalogContext() {
    return {
      skillRegistry: this.params.skillRegistry(),
      llmProvider: this.params.llmProvider(),
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    };
  }

  getTaskContext() {
    return {
      orchestrator: this.params.orchestrator(),
      runtimeStateRepository: this.params.runtimeStateRepository(),
      resolveTaskSkillSuggestions: (goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) =>
        this.resolveTaskSkillSuggestions(goal, options)
    };
  }

  getCentersContext() {
    return {
      settings: this.params.settings(),
      wenyuanFacade: this.params.wenyuanFacade(),
      sessionCoordinator: this.params.sessionCoordinator(),
      orchestrator: this.params.orchestrator(),
      runtimeStateRepository: this.params.runtimeStateRepository(),
      memoryRepository: this.params.memoryRepository(),
      ruleRepository: this.params.ruleRepository(),
      skillRegistry: this.params.skillRegistry(),
      toolRegistry: this.params.toolRegistry(),
      mcpClientManager: this.params.mcpClientManager(),
      mcpServerRegistry: this.params.mcpServerRegistry(),
      mcpCapabilityRegistry: this.params.mcpCapabilityRegistry(),
      describeConnectorProfilePolicy: this.params.describeConnectorProfilePolicy,
      fetchProviderUsageAudit: (days: number) => this.fetchProviderUsageAudit(days),
      getBackgroundWorkerSlots: () => this.getBackgroundWorkerSlots(),
      getConnectorRegistryContext: () => this.getConnectorRegistryContext(),
      getSkillInstallContext: () => this.getSkillInstallContext(),
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      getPlatformConsoleContext: () => this.getPlatformConsoleContext()
    };
  }
}
