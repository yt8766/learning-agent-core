import { describeConnectorProfilePolicy, fetchProviderUsageAudit } from '@agent/runtime';
import { RuntimeCentersGovernanceService } from '../centers/runtime-centers-governance.service';
import { RuntimeCentersQueryService } from '../centers/runtime-centers-query.service';
import { RuntimeCentersService } from '../centers/runtime-centers.service';
import { refreshMetricsSnapshots as refreshMetricsSnapshotsWithGovernance } from '../centers/runtime-centers-governance-metrics';
import { RuntimeHost } from './runtime.host';
import { RuntimeKnowledgeService } from '../services/runtime-knowledge.service';
import { RuntimeBootstrapService } from '../services/runtime-bootstrap.service';
import { RuntimeMessageGatewayFacadeService } from '../services/runtime-message-gateway-facade.service';
import { RuntimeOperationalStateService } from '../services/runtime-operational-state.service';
import { RuntimeSessionService } from '../services/runtime-session.service';
import { RuntimeSkillCatalogService } from '../services/runtime-skill-catalog.service';
import { RuntimeTaskService } from '../services/runtime-task.service';
import { RuntimeToolsService } from '../services/runtime-tools.service';
import { searchLocalSkillSuggestions } from '../skills/runtime-skill-sources.service';
import { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
import { RuntimeScheduleService } from '../schedules/runtime-schedule.service';
import type { AppLoggerService } from '../../logger/app-logger.service';
import {
  applyProviderFactoryGovernanceOverrides,
  createProviderFactoryBackgroundRunnerContext,
  createProviderFactoryCentersService,
  createProviderFactoryConnectorRegistryContext,
  createProviderFactoryKnowledgeContext,
  createProviderFactorySkillSourcesContext,
  initializeProviderFactoryMetricsSnapshots,
  syncProviderFactoryInstalledSkillWorkers
} from './runtime-provider-factory-contexts';

export function createRuntimeTechBriefingService(runtimeHost: RuntimeHost) {
  return new RuntimeTechBriefingService(() => ({
    settings: runtimeHost.settings,
    mcpClientManager: runtimeHost.mcpClientManager,
    llmProvider: runtimeHost.llmProvider
  }));
}

export function createRuntimeScheduleService(
  runtimeHost: RuntimeHost,
  techBriefingService: RuntimeTechBriefingService
) {
  return new RuntimeScheduleService(() => ({
    settings: runtimeHost.settings,
    techBriefingService,
    refreshMetricsSnapshots: (days: number) =>
      refreshMetricsSnapshotsWithGovernance(
        {
          orchestrator: runtimeHost.orchestrator,
          runtimeStateRepository: runtimeHost.runtimeStateRepository,
          fetchProviderUsageAudit: (auditDays: number) =>
            fetchProviderUsageAudit(
              runtimeHost.settings.providerAudit.adapters,
              runtimeHost.settings.providerAudit.primaryProvider,
              auditDays
            )
        },
        days
      )
  }));
}

export function createRuntimeKnowledgeService(runtimeHost: RuntimeHost) {
  return new RuntimeKnowledgeService(() => createProviderFactoryKnowledgeContext(runtimeHost));
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
      searchLocalSkillSuggestions(createProviderFactorySkillSourcesContext(runtimeHost), goal, options)
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
    getConnectorRegistryContext: () => createProviderFactoryConnectorRegistryContext(runtimeHost)
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
  operationalState: RuntimeOperationalStateService,
  techBriefingService: RuntimeTechBriefingService,
  runtimeScheduleService: RuntimeScheduleService
) {
  return new RuntimeBootstrapService(() => ({
    sessionCoordinator: runtimeHost.sessionCoordinator,
    orchestrator: runtimeHost.orchestrator,
    getSkillSourcesContext: () => createProviderFactorySkillSourcesContext(runtimeHost),
    syncInstalledSkillWorkers: async () => syncProviderFactoryInstalledSkillWorkers(runtimeHost),
    applyStoredGovernanceOverrides: async () => applyProviderFactoryGovernanceOverrides(runtimeHost),
    initializeMetricsSnapshots: async () => {
      await initializeProviderFactoryMetricsSnapshots(runtimeHost, operationalState, techBriefingService, 30);
    },
    initializeDailyTechBriefing: async () => {
      await techBriefingService.initializeSchedule();
    },
    initializeScheduleRunner: async () => {
      await runtimeScheduleService.initialize();
    },
    getBackgroundRunnerContext: () => createProviderFactoryBackgroundRunnerContext(runtimeHost, operationalState)
  }));
}

export function createRuntimeCentersService(
  runtimeHost: RuntimeHost,
  operationalState: RuntimeOperationalStateService,
  techBriefingService: RuntimeTechBriefingService,
  appLogger?: AppLoggerService
) {
  return createProviderFactoryCentersService(runtimeHost, operationalState, techBriefingService, appLogger);
}
