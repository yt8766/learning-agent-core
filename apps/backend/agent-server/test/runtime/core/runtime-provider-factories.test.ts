import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  registerInstalledSkillWorkerMock,
  applyGovernanceOverridesMock,
  fetchProviderUsageAuditMock,
  autoInstallLocalManifestMock,
  searchLocalSkillSuggestionsMock,
  RuntimeTechBriefingServiceMock,
  RuntimeScheduleServiceMock,
  RuntimeWenyuanFacadeMock,
  RuntimeKnowledgeServiceMock,
  RuntimeSessionServiceMock,
  RuntimeSkillCatalogServiceMock,
  RuntimeTaskServiceMock,
  RuntimeToolsServiceMock,
  RuntimeMessageGatewayFacadeServiceMock,
  RuntimeBootstrapServiceMock,
  RuntimeCentersQueryServiceMock,
  RuntimeCentersGovernanceServiceMock,
  RuntimeCentersServiceMock
} = vi.hoisted(() => {
  const registerInstalledSkillWorkerMock = vi.fn();
  const applyGovernanceOverridesMock = vi.fn();
  const fetchProviderUsageAuditMock = vi.fn(async () => ({ status: 'synced', daily: [] }));
  const autoInstallLocalManifestMock = vi.fn(async () => ({ installed: true }));
  const searchLocalSkillSuggestionsMock = vi.fn(async () => [{ id: 'skill-1' }]);

  const RuntimeTechBriefingServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'tech-briefing',
      factory,
      initializeSchedule: vi.fn(async () => undefined)
    };
  });
  const RuntimeScheduleServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'schedule',
      factory,
      initialize: vi.fn(async () => undefined)
    };
  });
  const RuntimeWenyuanFacadeMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'wenyuan',
      factory
    };
  });
  const RuntimeKnowledgeServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'knowledge',
      factory
    };
  });
  const RuntimeSessionServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'session',
      factory
    };
  });
  const RuntimeSkillCatalogServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'skill-catalog',
      factory
    };
  });
  const RuntimeTaskServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'task',
      factory
    };
  });
  const RuntimeToolsServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'tools',
      factory
    };
  });
  const RuntimeMessageGatewayFacadeServiceMock = vi.fn(function (
    this: unknown,
    runtimeSessionService: unknown,
    runtimeTaskService: unknown
  ) {
    return {
      kind: 'gateway',
      runtimeSessionService,
      runtimeTaskService
    };
  });
  const RuntimeBootstrapServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'bootstrap',
      factory
    };
  });
  const RuntimeCentersQueryServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'query',
      factory
    };
  });
  const RuntimeCentersGovernanceServiceMock = vi.fn(function (this: unknown, factory: () => unknown) {
    return {
      kind: 'governance',
      factory
    };
  });
  const RuntimeCentersServiceMock = vi.fn(function (
    this: unknown,
    factory: () => unknown,
    queryService: unknown,
    governanceService: unknown
  ) {
    return {
      kind: 'centers',
      factory,
      queryService,
      governanceService,
      getRuntimeCenter: vi.fn((days?: number, filters?: Record<string, unknown>) => ({
        days,
        filters,
        scope: 'runtime'
      })),
      getRuntimeCenterSummary: vi.fn((days?: number, filters?: Record<string, unknown>) => ({
        days,
        filters,
        scope: 'runtime-summary'
      })),
      getApprovalsCenter: vi.fn(() => ({ scope: 'approvals' })),
      getLearningCenter: vi.fn(() => ({ scope: 'learning' })),
      getEvalsCenter: vi.fn((days?: number, filters?: Record<string, unknown>) => ({ days, filters, scope: 'evals' })),
      getEvalsCenterSummary: vi.fn((days?: number, filters?: Record<string, unknown>) => ({
        days,
        filters,
        scope: 'evals-summary'
      })),
      getEvidenceCenter: vi.fn(() => ({ scope: 'evidence' })),
      getToolsCenter: vi.fn(() => ({ scope: 'tools' })),
      getConnectorsCenter: vi.fn(() => ({ scope: 'connectors' })),
      getSkillSourcesCenter: vi.fn(() => ({ scope: 'skill-sources' })),
      getCompanyAgentsCenter: vi.fn(() => ({ scope: 'company-agents' }))
    };
  });

  return {
    registerInstalledSkillWorkerMock,
    applyGovernanceOverridesMock,
    fetchProviderUsageAuditMock,
    autoInstallLocalManifestMock,
    searchLocalSkillSuggestionsMock,
    RuntimeTechBriefingServiceMock,
    RuntimeScheduleServiceMock,
    RuntimeWenyuanFacadeMock,
    RuntimeKnowledgeServiceMock,
    RuntimeSessionServiceMock,
    RuntimeSkillCatalogServiceMock,
    RuntimeTaskServiceMock,
    RuntimeToolsServiceMock,
    RuntimeMessageGatewayFacadeServiceMock,
    RuntimeBootstrapServiceMock,
    RuntimeCentersQueryServiceMock,
    RuntimeCentersGovernanceServiceMock,
    RuntimeCentersServiceMock
  };
});

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  applyGovernanceOverrides: applyGovernanceOverridesMock,
  registerInstalledSkillWorker: registerInstalledSkillWorkerMock
}));
vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    fetchProviderUsageAudit: fetchProviderUsageAuditMock
  };
});
vi.mock('../../../src/runtime/services/runtime-knowledge.service', () => ({
  RuntimeKnowledgeService: RuntimeKnowledgeServiceMock
}));
vi.mock('../../../src/runtime/wenyuan/runtime-wenyuan-facade', () => ({
  RuntimeWenyuanFacade: RuntimeWenyuanFacadeMock
}));
vi.mock('../../../src/runtime/services/runtime-session.service', () => ({
  RuntimeSessionService: RuntimeSessionServiceMock
}));
vi.mock('../../../src/runtime/services/runtime-skill-catalog.service', () => ({
  RuntimeSkillCatalogService: RuntimeSkillCatalogServiceMock
}));
vi.mock('../../../src/runtime/services/runtime-task.service', () => ({
  RuntimeTaskService: RuntimeTaskServiceMock
}));
vi.mock('../../../src/runtime/services/runtime-tools.service', () => ({
  RuntimeToolsService: RuntimeToolsServiceMock
}));
vi.mock('../../../src/runtime/services/runtime-message-gateway-facade.service', () => ({
  RuntimeMessageGatewayFacadeService: RuntimeMessageGatewayFacadeServiceMock
}));
vi.mock('../../../src/runtime/services/runtime-bootstrap.service', () => ({
  RuntimeBootstrapService: RuntimeBootstrapServiceMock
}));
vi.mock('../../../src/runtime/centers/runtime-centers-query.service', () => ({
  RuntimeCentersQueryService: RuntimeCentersQueryServiceMock
}));
vi.mock('../../../src/runtime/centers/runtime-centers-governance.service', () => ({
  RuntimeCentersGovernanceService: RuntimeCentersGovernanceServiceMock
}));
vi.mock('../../../src/runtime/centers/runtime-centers.service', () => ({
  RuntimeCentersService: RuntimeCentersServiceMock
}));
vi.mock('../../../src/runtime/briefings/runtime-tech-briefing.service', () => ({
  RuntimeTechBriefingService: RuntimeTechBriefingServiceMock
}));
vi.mock('../../../src/runtime/schedules/runtime-schedule.service', () => ({
  RuntimeScheduleService: RuntimeScheduleServiceMock
}));
vi.mock('../../../src/runtime/skills/runtime-skill-install.service', () => ({
  autoInstallLocalManifest: autoInstallLocalManifestMock
}));
vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', async () => {
  const actual = await vi.importActual('../../../src/runtime/skills/runtime-skill-sources.service');
  return {
    ...actual,
    searchLocalSkillSuggestions: searchLocalSkillSuggestionsMock,
    listSkillSources: vi.fn(async () => [{ id: 'source-1' }])
  };
});

import {
  createRuntimeBootstrapService,
  createRuntimeCentersService,
  createRuntimeKnowledgeService,
  createRuntimeMessageGatewayFacadeService,
  createRuntimeScheduleService,
  createRuntimeSessionService,
  createRuntimeSkillCatalogService,
  createRuntimeTaskService,
  createRuntimeTechBriefingService,
  createRuntimeToolsService
} from '../../../src/runtime/core/runtime-provider-factories';

describe('runtime-provider-factories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRuntimeHost() {
    return {
      settings: {
        runtimeBackground: {
          enabled: true,
          runnerIdPrefix: 'runner',
          workerPoolSize: 2,
          leaseTtlMs: 1000,
          heartbeatMs: 500,
          pollMs: 250
        },
        providerAudit: {
          adapters: [{ provider: 'glm', endpoint: 'https://audit.example.com', apiKey: '', source: 'primary' }],
          primaryProvider: 'glm'
        },
        workspaceRoot: '/tmp/workspace'
      },
      memoryRepository: { kind: 'memory' },
      ruleRepository: { kind: 'rules' },
      skillRegistry: {
        list: vi.fn(async () => [
          { id: 'skill-installed', installReceiptId: 'receipt-1' },
          { id: 'skill-source', sourceId: 'source-1' },
          { id: 'skill-local' }
        ])
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governance: { disabledSkillSourceIds: ['blocked-source'] } })),
        save: vi.fn(async () => undefined)
      },
      toolRegistry: { kind: 'tools' },
      mcpServerRegistry: { kind: 'servers' },
      mcpCapabilityRegistry: { kind: 'capabilities' },
      mcpClientManager: { kind: 'mcp-client-manager' },
      orchestrator: {
        kind: 'orchestrator',
        listTasks: vi.fn(() => [])
      },
      sessionCoordinator: { kind: 'session-coordinator' },
      skillSourceSyncService: { kind: 'skill-source-sync-service' },
      remoteSkillDiscoveryService: {
        installRemoteSkill: vi.fn(async () => ({ ok: true })),
        checkInstalledSkills: vi.fn(async () => ({ ok: true })),
        updateInstalledSkills: vi.fn(async () => ({ ok: true }))
      },
      skillArtifactFetcher: { kind: 'skill-artifact-fetcher' }
    } as any;
  }

  it('creates service wrappers with runtime host dependencies wired through', async () => {
    const runtimeHost = createRuntimeHost();
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map([['worker-1', 'busy']])),
      isBackgroundRunnerSweepInFlight: vi.fn(() => false),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;

    const techBriefingService = createRuntimeTechBriefingService(runtimeHost);
    const scheduleService = createRuntimeScheduleService(runtimeHost, techBriefingService as any);
    const knowledgeService = createRuntimeKnowledgeService(runtimeHost);
    const sessionService = createRuntimeSessionService(runtimeHost);
    const skillCatalogService = createRuntimeSkillCatalogService(runtimeHost);
    const taskService = createRuntimeTaskService(runtimeHost);
    const toolsService = createRuntimeToolsService(runtimeHost);
    const gatewayService = createRuntimeMessageGatewayFacadeService(sessionService as any, taskService as any);
    const bootstrapService = createRuntimeBootstrapService(
      runtimeHost,
      operationalState,
      techBriefingService as any,
      scheduleService as any
    );
    const centersService = createRuntimeCentersService(runtimeHost, operationalState);

    expect(RuntimeTechBriefingServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeScheduleServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeKnowledgeServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeSessionServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeSkillCatalogServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeTaskServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeToolsServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeMessageGatewayFacadeServiceMock).toHaveBeenCalledWith(sessionService, taskService);
    expect(RuntimeBootstrapServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeCentersQueryServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeCentersGovernanceServiceMock).toHaveBeenCalledTimes(1);
    expect(RuntimeCentersServiceMock).toHaveBeenCalledTimes(1);
    expect(gatewayService).toEqual(
      expect.objectContaining({
        kind: 'gateway',
        runtimeSessionService: sessionService,
        runtimeTaskService: taskService
      })
    );
    expect(scheduleService.factory()).toEqual(
      expect.objectContaining({
        refreshMetricsSnapshots: expect.any(Function)
      })
    );
    expect(knowledgeService).toEqual(expect.objectContaining({ kind: 'knowledge' }));
    expect(skillCatalogService).toEqual(expect.objectContaining({ kind: 'skill-catalog' }));
    expect(toolsService).toEqual(expect.objectContaining({ kind: 'tools' }));
    expect(bootstrapService).toEqual(expect.objectContaining({ kind: 'bootstrap' }));
    expect(centersService).toEqual(expect.objectContaining({ kind: 'centers' }));
  });

  it('exposes task/bootstrap contexts that resolve skills, governance and installed workers', async () => {
    const runtimeHost = createRuntimeHost();
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map([['worker-1', 'busy']])),
      isBackgroundRunnerSweepInFlight: vi.fn(() => true),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;

    const taskService = createRuntimeTaskService(runtimeHost) as any;
    const taskContext = taskService.factory();
    const suggestions = await taskContext.resolveTaskSkillSuggestions('review current repo', {
      usedInstalledSkills: ['skill-installed'],
      limit: 3
    });

    const bootstrapService = createRuntimeBootstrapService(
      runtimeHost,
      operationalState,
      { initializeSchedule: vi.fn(async () => undefined) } as any,
      { initialize: vi.fn(async () => undefined) } as any
    ) as any;
    const bootstrapContext = bootstrapService.factory();

    await bootstrapContext.syncInstalledSkillWorkers();
    await bootstrapContext.applyStoredGovernanceOverrides();
    const disabledSourceIds = await bootstrapContext.getSkillSourcesContext().getDisabledSkillSourceIds();
    await bootstrapContext.getSkillSourcesContext().autoInstallLocalManifest({ id: 'manifest-1' });
    const listedSources = await bootstrapContext.getSkillSourcesContext().listSkillSources();
    const backgroundContext = bootstrapContext.getBackgroundRunnerContext();
    backgroundContext.setSweepInFlight(true);

    expect(searchLocalSkillSuggestionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: runtimeHost.settings,
        toolRegistry: runtimeHost.toolRegistry,
        skillRegistry: runtimeHost.skillRegistry
      }),
      'review current repo',
      { usedInstalledSkills: ['skill-installed'], limit: 3 }
    );
    expect(suggestions).toEqual([{ id: 'skill-1' }]);
    expect(registerInstalledSkillWorkerMock).toHaveBeenCalledTimes(2);
    expect(registerInstalledSkillWorkerMock).toHaveBeenCalledWith(expect.any(Object), {
      id: 'skill-installed',
      installReceiptId: 'receipt-1'
    });
    expect(registerInstalledSkillWorkerMock).toHaveBeenCalledWith(expect.any(Object), {
      id: 'skill-source',
      sourceId: 'source-1'
    });
    expect(applyGovernanceOverridesMock).toHaveBeenCalledWith(expect.any(Object), {
      governance: { disabledSkillSourceIds: ['blocked-source'] }
    });
    expect(disabledSourceIds).toEqual(['blocked-source']);
    expect(autoInstallLocalManifestMock).toHaveBeenCalledWith(expect.any(Object), { id: 'manifest-1' });
    expect(listedSources).toEqual([{ id: 'source-1' }]);
    expect(backgroundContext).toEqual(
      expect.objectContaining({
        enabled: true,
        runnerId: expect.stringContaining('runner-'),
        workerPoolSize: 2,
        leaseTtlMs: 1000,
        heartbeatMs: 500,
        pollMs: 250,
        backgroundWorkerSlots: expect.any(Map)
      })
    );
    expect(operationalState.setBackgroundRunnerSweepInFlight).toHaveBeenCalledWith(true);
  });

  it('builds centers context with provider audit and platform console delegates', async () => {
    const runtimeHost = createRuntimeHost();
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map()),
      isBackgroundRunnerSweepInFlight: vi.fn(() => false),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;

    const centersService = createRuntimeCentersService(runtimeHost, operationalState) as any;
    const centersContext = centersService.factory();

    const providerAudit = await centersContext.fetchProviderUsageAudit(14);
    const platformConsoleContext = centersContext.getPlatformConsoleContext();
    const runtimeCenter = platformConsoleContext.getRuntimeCenter(7, { status: 'running' });
    const approvalsCenter = platformConsoleContext.getApprovalsCenter();
    const companyAgentsCenter = platformConsoleContext.getCompanyAgentsCenter();

    expect(fetchProviderUsageAuditMock).toHaveBeenCalledWith(
      runtimeHost.settings.providerAudit.adapters,
      runtimeHost.settings.providerAudit.primaryProvider,
      14
    );
    expect(providerAudit).toEqual({ status: 'synced', daily: [] });
    expect(runtimeCenter).toEqual({ days: 7, filters: { status: 'running' }, scope: 'runtime' });
    expect(approvalsCenter).toEqual({ scope: 'approvals' });
    expect(companyAgentsCenter).toEqual({ scope: 'company-agents' });
  });
});
