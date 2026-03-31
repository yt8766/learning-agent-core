import { describeConnectorProfilePolicy } from '@agent/agent-core';
import { SkillCard, SkillManifestRecord } from '@agent/shared';

import { applyGovernanceOverrides, registerInstalledSkillWorker } from '../helpers/runtime-connector-registry';
import { fetchProviderUsageAudit } from '../helpers/provider-audit';
import { RuntimeCentersGovernanceService } from '../centers/runtime-centers-governance.service';
import { RuntimeCentersQueryService } from '../centers/runtime-centers-query.service';
import { RuntimeCentersService } from '../centers/runtime-centers.service';
import { RuntimeHost } from './runtime.host';
import { RuntimeKnowledgeService } from '../services/runtime-knowledge.service';
import { RuntimeBootstrapService } from '../services/runtime-bootstrap.service';
import { RuntimeMessageGatewayFacadeService } from '../services/runtime-message-gateway-facade.service';
import { RuntimeOperationalStateService } from '../services/runtime-operational-state.service';
import { RuntimeSessionService } from '../services/runtime-session.service';
import { RuntimeSkillCatalogService } from '../services/runtime-skill-catalog.service';
import { RuntimeTaskService } from '../services/runtime-task.service';
import { RuntimeToolsService } from '../services/runtime-tools.service';
import { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';
import { autoInstallLocalManifest, type RuntimeSkillInstallContext } from '../skills/runtime-skill-install.service';
import { searchLocalSkillSuggestions, type RuntimeSkillSourcesContext } from '../skills/runtime-skill-sources.service';

export function createRuntimeKnowledgeService(runtimeHost: RuntimeHost) {
  const wenyuanFacade = new RuntimeWenyuanFacade(() => ({
    settings: runtimeHost.settings,
    memoryRepository: runtimeHost.memoryRepository,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator
  }));
  return new RuntimeKnowledgeService(() => ({
    wenyuanFacade,
    ruleRepository: runtimeHost.ruleRepository,
    orchestrator: runtimeHost.orchestrator,
    runtimeStateRepository: runtimeHost.runtimeStateRepository
  }));
}

export function createRuntimeSessionService(runtimeHost: RuntimeHost) {
  return new RuntimeSessionService(() => ({
    sessionCoordinator: runtimeHost.sessionCoordinator
  }));
}

export function createRuntimeSkillCatalogService(runtimeHost: RuntimeHost) {
  return new RuntimeSkillCatalogService(() => ({
    skillRegistry: runtimeHost.skillRegistry
  }));
}

export function createRuntimeTaskService(runtimeHost: RuntimeHost) {
  return new RuntimeTaskService(() => ({
    orchestrator: runtimeHost.orchestrator,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    resolveTaskSkillSuggestions: (goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) =>
      searchLocalSkillSuggestions(createSkillSourcesContext(runtimeHost), goal, options)
  }));
}

export function createRuntimeToolsService(runtimeHost: RuntimeHost) {
  return new RuntimeToolsService(() => ({
    settings: runtimeHost.settings,
    toolRegistry: runtimeHost.toolRegistry,
    orchestrator: runtimeHost.orchestrator,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    mcpServerRegistry: runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: runtimeHost.mcpCapabilityRegistry,
    mcpClientManager: runtimeHost.mcpClientManager,
    describeConnectorProfilePolicy,
    getConnectorRegistryContext: () => createConnectorRegistryContext(runtimeHost)
  }));
}

export function createRuntimeMessageGatewayFacadeService(
  runtimeSessionService: RuntimeSessionService,
  runtimeTaskService: RuntimeTaskService
) {
  return new RuntimeMessageGatewayFacadeService(runtimeSessionService, runtimeTaskService);
}

export function createRuntimeBootstrapService(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService
) {
  return new RuntimeBootstrapService(() => ({
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator,
    getSkillSourcesContext: () => createSkillSourcesContext(runtimeHost),
    syncInstalledSkillWorkers: async () => {
      const skills = await runtimeHost.skillRegistry.list();
      skills
        .filter((skill: any) => Boolean(skill.installReceiptId || skill.sourceId))
        .forEach((skill: SkillCard) =>
          registerInstalledSkillWorker(createConnectorRegistryContext(runtimeHost), skill)
        );
    },
    applyStoredGovernanceOverrides: async () => {
      const snapshot = await runtimeHost.runtimeStateRepository.load();
      applyGovernanceOverrides(createConnectorRegistryContext(runtimeHost), snapshot);
    },
    getBackgroundRunnerContext: () => ({
      enabled: runtimeHost.settings.runtimeBackground.enabled,
      orchestrator: runtimeHost.orchestrator,
      runnerId: `${runtimeHost.settings.runtimeBackground.runnerIdPrefix}-${process.pid}`,
      workerPoolSize: runtimeHost.settings.runtimeBackground.workerPoolSize,
      leaseTtlMs: runtimeHost.settings.runtimeBackground.leaseTtlMs,
      heartbeatMs: runtimeHost.settings.runtimeBackground.heartbeatMs,
      pollMs: runtimeHost.settings.runtimeBackground.pollMs,
      backgroundWorkerSlots: operationalState.getBackgroundWorkerSlots(),
      isSweepInFlight: () => operationalState.isBackgroundRunnerSweepInFlight(),
      setSweepInFlight: value => {
        operationalState.setBackgroundRunnerSweepInFlight(value);
      }
    })
  }));
}

export function createRuntimeCentersService(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService
) {
  const wenyuanFacade = new RuntimeWenyuanFacade(() => ({
    settings: runtimeHost.settings,
    memoryRepository: runtimeHost.memoryRepository,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator
  }));
  const context = {
    settings: runtimeHost.settings,
    wenyuanFacade,
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    memoryRepository: runtimeHost.memoryRepository,
    ruleRepository: runtimeHost.ruleRepository,
    skillRegistry: runtimeHost.skillRegistry,
    toolRegistry: runtimeHost.toolRegistry,
    mcpClientManager: runtimeHost.mcpClientManager,
    mcpServerRegistry: runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: runtimeHost.mcpCapabilityRegistry,
    describeConnectorProfilePolicy,
    fetchProviderUsageAudit: (days: number) =>
      fetchProviderUsageAudit(
        runtimeHost.settings.providerAudit.adapters,
        runtimeHost.settings.providerAudit.primaryProvider,
        days
      ),
    getBackgroundWorkerSlots: () => operationalState.getBackgroundWorkerSlots(),
    getConnectorRegistryContext: () => createConnectorRegistryContext(runtimeHost),
    getSkillInstallContext: () => createSkillInstallContext(runtimeHost),
    getSkillSourcesContext: () => createSkillSourcesContext(runtimeHost),
    getPlatformConsoleContext: () => ({
      skillRegistry: runtimeHost.skillRegistry,
      orchestrator: runtimeHost.orchestrator,
      sessionCoordinator: runtimeHost.sessionCoordinator,
      getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) =>
        centersService.getRuntimeCenter(days, filters),
      getApprovalsCenter: () => centersService.getApprovalsCenter(),
      getLearningCenter: () => centersService.getLearningCenter(),
      getEvalsCenter: (days?: number, filters?: Record<string, unknown>) =>
        centersService.getEvalsCenter(days, filters),
      getEvidenceCenter: () => centersService.getEvidenceCenter(),
      getToolsCenter: () => centersService.getToolsCenter(),
      getConnectorsCenter: () => centersService.getConnectorsCenter(),
      getSkillSourcesCenter: () => centersService.getSkillSourcesCenter(),
      getCompanyAgentsCenter: () => centersService.getCompanyAgentsCenter()
    })
  };
  const queryService = new RuntimeCentersQueryService(() => context);
  const governanceService = new RuntimeCentersGovernanceService(() => context);
  const centersService = new RuntimeCentersService(() => context, queryService, governanceService);
  return centersService;
}

function createConnectorRegistryContext(runtimeHost: RuntimeHost) {
  return {
    settings: runtimeHost.settings,
    mcpServerRegistry: runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: runtimeHost.mcpCapabilityRegistry,
    mcpClientManager: runtimeHost.mcpClientManager,
    orchestrator: runtimeHost.orchestrator
  };
}

function createSkillInstallContext(runtimeHost: RuntimeHost): RuntimeSkillInstallContext {
  return {
    settings: runtimeHost.settings,
    skillRegistry: runtimeHost.skillRegistry,
    skillArtifactFetcher: runtimeHost.skillArtifactFetcher,
    listSkillSources: () => createSkillSourcesContext(runtimeHost).listSkillSources?.() ?? Promise.resolve([]),
    remoteSkillCli: {
      install: (params: { repo: string; skillName?: string }) =>
        runtimeHost.remoteSkillDiscoveryService.installRemoteSkill(params),
      check: () => runtimeHost.remoteSkillDiscoveryService.checkInstalledSkills(),
      update: () => runtimeHost.remoteSkillDiscoveryService.updateInstalledSkills()
    },
    registerInstalledSkillWorker: (skill: SkillCard) =>
      registerInstalledSkillWorker(createConnectorRegistryContext(runtimeHost), skill)
  };
}

function createSkillSourcesContext(runtimeHost: RuntimeHost): RuntimeSkillSourcesContext & {
  listSkillSources?: () => Promise<any[]>;
} {
  const context: RuntimeSkillSourcesContext & { listSkillSources?: () => Promise<any[]> } = {
    settings: runtimeHost.settings,
    toolRegistry: runtimeHost.toolRegistry,
    skillRegistry: runtimeHost.skillRegistry,
    skillSourceSyncService: runtimeHost.skillSourceSyncService,
    remoteSkillDiscoveryService: runtimeHost.remoteSkillDiscoveryService,
    getDisabledSkillSourceIds: async () => {
      const snapshot = await runtimeHost.runtimeStateRepository.load();
      return snapshot.governance?.disabledSkillSourceIds ?? [];
    },
    autoInstallLocalManifest: (manifest: SkillManifestRecord) =>
      autoInstallLocalManifest(createSkillInstallContext(runtimeHost), manifest)
  };
  context.listSkillSources = async () => {
    const { listSkillSources } = await import('../skills/runtime-skill-sources.service');
    return listSkillSources(context);
  };
  return context;
}
