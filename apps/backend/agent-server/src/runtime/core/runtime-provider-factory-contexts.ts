import { describeConnectorProfilePolicy, fetchProviderUsageAudit } from '@agent/runtime';
import type { SkillCard } from '@agent/core';

import { applyGovernanceOverrides, registerInstalledSkillWorker } from '../helpers/runtime-connector-registry';
import { createBackgroundRunnerContext } from '../domain/background/runtime-background-context';
import { createCentersContext } from '../domain/centers/runtime-centers-context';
import { createPlatformConsoleContext } from '../domain/centers/runtime-platform-console-context';
import { createKnowledgeContext } from '../domain/knowledge/runtime-knowledge-context';
import { createSkillInstallContext, createSkillSourcesContext } from '../domain/skills/runtime-skill-contexts';
import { syncInstalledSkillWorkers } from '../domain/skills/runtime-skill-orchestration';
import { RuntimeCentersGovernanceService } from '../centers/runtime-centers-governance.service';
import { refreshMetricsSnapshots as refreshMetricsSnapshotsWithGovernance } from '../centers/runtime-centers-governance-metrics';
import { RuntimeCentersQueryService } from '../centers/runtime-centers-query.service';
import { RuntimeCentersService } from '../centers/runtime-centers.service';
import type {
  PlatformConsoleCompanyAgentsRecord,
  RuntimePlatformConsoleContext
} from '../centers/runtime-platform-console.records';
import { RuntimeOperationalStateService } from '../services/runtime-operational-state.service';
import { RuntimeWenyuanFacade } from '../wenyuan/runtime-wenyuan-facade';
import { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
import type { AppLoggerService } from '../../logger/app-logger.service';
import type { RuntimeHost } from './runtime.host';

export function createProviderFactoryUnsupportedPlatformConsoleContext(): RuntimePlatformConsoleContext {
  const unsupported = (name: string) => () => {
    throw new Error(`${name} is not available in bootstrap-only platform console context`);
  };

  return {
    skillRegistry: {
      list: async () => []
    },
    orchestrator: {
      listRules: async () => [],
      listTasks: () => []
    },
    sessionCoordinator: {
      listSessions: () => [],
      getCheckpoint: () => undefined
    },
    getRuntimeCenter: async () => unsupported('getRuntimeCenter')(),
    getApprovalsCenter: () => [],
    getLearningCenter: async () => unsupported('getLearningCenter')(),
    getEvalsCenter: async () => unsupported('getEvalsCenter')(),
    getEvidenceCenter: async () => ({
      totalEvidenceCount: 0,
      recentEvidence: []
    }),
    getToolsCenter: unsupported('getToolsCenter'),
    getConnectorsCenter: async () => [],
    getSkillSourcesCenter: async () => ({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    }),
    getCompanyAgentsCenter: () => [] as PlatformConsoleCompanyAgentsRecord
  };
}

export function createProviderFactoryConnectorRegistryContext(runtimeHost: RuntimeHost) {
  return {
    settings: runtimeHost.settings,
    mcpServerRegistry: runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: runtimeHost.mcpCapabilityRegistry,
    mcpClientManager: runtimeHost.mcpClientManager,
    orchestrator: runtimeHost.orchestrator
  };
}

export function createProviderFactorySkillInstallContext(runtimeHost: RuntimeHost) {
  return createSkillInstallContext({
    settings: runtimeHost.settings,
    skillRegistry: runtimeHost.skillRegistry,
    skillArtifactFetcher: runtimeHost.skillArtifactFetcher,
    remoteSkillDiscoveryService: runtimeHost.remoteSkillDiscoveryService,
    getSkillSourcesContext: () => createProviderFactorySkillSourcesContext(runtimeHost),
    registerSkillWorker: (skill: SkillCard) =>
      registerInstalledSkillWorker(createProviderFactoryConnectorRegistryContext(runtimeHost), skill)
  });
}

export function createProviderFactorySkillSourcesContext(runtimeHost: RuntimeHost) {
  return createSkillSourcesContext({
    settings: runtimeHost.settings,
    toolRegistry: runtimeHost.toolRegistry,
    skillRegistry: runtimeHost.skillRegistry,
    skillSourceSyncService: runtimeHost.skillSourceSyncService,
    remoteSkillDiscoveryService: runtimeHost.remoteSkillDiscoveryService,
    getDisabledSkillSourceIds: async () => {
      const snapshot = await runtimeHost.runtimeStateRepository.load();
      return snapshot.governance?.disabledSkillSourceIds ?? [];
    },
    getSkillInstallContext: () => createProviderFactorySkillInstallContext(runtimeHost)
  });
}

function createProviderFactoryWenyuanFacade(runtimeHost: RuntimeHost) {
  return new RuntimeWenyuanFacade(() => ({
    settings: runtimeHost.settings,
    memoryRepository: runtimeHost.memoryRepository,
    runtimeStateRepository: runtimeHost.runtimeStateRepository,
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator
  }));
}

export function createProviderFactoryKnowledgeContext(runtimeHost: RuntimeHost) {
  return createKnowledgeContext({
    wenyuanFacade: () => createProviderFactoryWenyuanFacade(runtimeHost),
    ruleRepository: () => runtimeHost.ruleRepository,
    orchestrator: () => runtimeHost.orchestrator,
    runtimeStateRepository: () => runtimeHost.runtimeStateRepository
  });
}

function createBootstrapCentersContext(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService,
  techBriefingService: RuntimeTechBriefingService
) {
  return createCentersContext({
    settings: () => runtimeHost.settings,
    wenyuanFacade: () => createProviderFactoryWenyuanFacade(runtimeHost),
    sessionCoordinator: () => runtimeHost.sessionCoordinator,
    orchestrator: () => runtimeHost.orchestrator,
    runtimeStateRepository: () => runtimeHost.runtimeStateRepository,
    memoryRepository: () => runtimeHost.memoryRepository,
    ruleRepository: () => runtimeHost.ruleRepository,
    skillRegistry: () => runtimeHost.skillRegistry,
    toolRegistry: () => runtimeHost.toolRegistry,
    mcpClientManager: () => runtimeHost.mcpClientManager,
    mcpServerRegistry: () => runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: () => runtimeHost.mcpCapabilityRegistry,
    describeConnectorProfilePolicy,
    fetchProviderUsageAudit: (days: number) =>
      fetchProviderUsageAudit(
        runtimeHost.settings.providerAudit.adapters,
        runtimeHost.settings.providerAudit.primaryProvider,
        days
      ),
    getBackgroundWorkerSlots: () => operationalState.getBackgroundWorkerSlots(),
    getConnectorRegistryContext: () => createProviderFactoryConnectorRegistryContext(runtimeHost),
    getSkillInstallContext: () => createProviderFactorySkillInstallContext(runtimeHost),
    getSkillSourcesContext: () => createProviderFactorySkillSourcesContext(runtimeHost),
    getPlatformConsoleContext: () => createProviderFactoryUnsupportedPlatformConsoleContext(),
    techBriefingService: () => techBriefingService
  });
}

export async function initializeProviderFactoryMetricsSnapshots(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService,
  techBriefingService: RuntimeTechBriefingService,
  days: number
) {
  await refreshMetricsSnapshotsWithGovernance(
    createBootstrapCentersContext(runtimeHost, operationalState, techBriefingService),
    days
  );
}

export async function syncProviderFactoryInstalledSkillWorkers(runtimeHost: RuntimeHost) {
  await syncInstalledSkillWorkers({
    skillRegistry: runtimeHost.skillRegistry,
    registerSkillWorker: (skill: SkillCard) =>
      registerInstalledSkillWorker(createProviderFactoryConnectorRegistryContext(runtimeHost), skill)
  });
}

export async function applyProviderFactoryGovernanceOverrides(runtimeHost: RuntimeHost) {
  const snapshot = await runtimeHost.runtimeStateRepository.load();
  applyGovernanceOverrides(createProviderFactoryConnectorRegistryContext(runtimeHost), snapshot);
}

export function createProviderFactoryBackgroundRunnerContext(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService
) {
  return createBackgroundRunnerContext({
    settings: () => runtimeHost.settings,
    orchestrator: () => runtimeHost.orchestrator,
    operationalState: () => operationalState,
    backgroundRunnerId: `${runtimeHost.settings.runtimeBackground.runnerIdPrefix}-${process.pid}`,
    backgroundWorkerPoolSize: runtimeHost.settings.runtimeBackground.workerPoolSize,
    backgroundLeaseTtlMs: runtimeHost.settings.runtimeBackground.leaseTtlMs,
    backgroundHeartbeatMs: runtimeHost.settings.runtimeBackground.heartbeatMs,
    backgroundPollMs: runtimeHost.settings.runtimeBackground.pollMs
  });
}

export function createProviderFactoryCentersService(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService,
  techBriefingService: RuntimeTechBriefingService,
  appLogger?: AppLoggerService
) {
  const wenyuanFacade = createProviderFactoryWenyuanFacade(runtimeHost);
  const centersServiceRef: { current?: RuntimeCentersService } = {};
  const context = createCentersContext({
    settings: () => runtimeHost.settings,
    appLogger: () => appLogger,
    techBriefingService: () => techBriefingService,
    wenyuanFacade: () => wenyuanFacade,
    sessionCoordinator: () => runtimeHost.sessionCoordinator,
    orchestrator: () => runtimeHost.orchestrator,
    runtimeStateRepository: () => runtimeHost.runtimeStateRepository,
    memoryRepository: () => runtimeHost.memoryRepository,
    ruleRepository: () => runtimeHost.ruleRepository,
    skillRegistry: () => runtimeHost.skillRegistry,
    toolRegistry: () => runtimeHost.toolRegistry,
    mcpClientManager: () => runtimeHost.mcpClientManager,
    mcpServerRegistry: () => runtimeHost.mcpServerRegistry,
    mcpCapabilityRegistry: () => runtimeHost.mcpCapabilityRegistry,
    describeConnectorProfilePolicy,
    fetchProviderUsageAudit: (days: number) =>
      fetchProviderUsageAudit(
        runtimeHost.settings.providerAudit.adapters,
        runtimeHost.settings.providerAudit.primaryProvider,
        days
      ),
    getBackgroundWorkerSlots: () => operationalState.getBackgroundWorkerSlots(),
    getConnectorRegistryContext: () => createProviderFactoryConnectorRegistryContext(runtimeHost),
    getSkillInstallContext: () => createProviderFactorySkillInstallContext(runtimeHost),
    getSkillSourcesContext: () => createProviderFactorySkillSourcesContext(runtimeHost),
    getPlatformConsoleContext: () =>
      createPlatformConsoleContext({
        skillRegistry: () => runtimeHost.skillRegistry,
        orchestrator: () => runtimeHost.orchestrator,
        sessionCoordinator: () => runtimeHost.sessionCoordinator,
        getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) =>
          centersServiceRef.current!.getRuntimeCenter(days, filters),
        getRuntimeCenterSummary: (days?: number, filters?: Record<string, unknown>) =>
          centersServiceRef.current!.getRuntimeCenterSummary(days, filters),
        getApprovalsCenter: () => centersServiceRef.current!.getApprovalsCenter(),
        getLearningCenter: () => centersServiceRef.current!.getLearningCenter(),
        getLearningCenterSummary: () => centersServiceRef.current!.getLearningCenterSummary(),
        getEvalsCenter: (days?: number, filters?: Record<string, unknown>) =>
          centersServiceRef.current!.getEvalsCenter(days, filters),
        getEvalsCenterSummary: (days?: number, filters?: Record<string, unknown>) =>
          centersServiceRef.current!.getEvalsCenterSummary(days, filters),
        getEvidenceCenter: () => centersServiceRef.current!.getEvidenceCenter(),
        getToolsCenter: () => centersServiceRef.current!.getToolsCenter(),
        getConnectorsCenter: () => centersServiceRef.current!.getConnectorsCenter(),
        getSkillSourcesCenter: () => centersServiceRef.current!.getSkillSourcesCenter(),
        getCompanyAgentsCenter: () => centersServiceRef.current!.getCompanyAgentsCenter()
      })
  });
  const queryService = new RuntimeCentersQueryService(() => context);
  const governanceService = new RuntimeCentersGovernanceService(() => context);
  const centersService = new RuntimeCentersService(() => context, queryService, governanceService);
  centersServiceRef.current = centersService;
  return centersService;
}
