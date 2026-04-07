import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  registerInstalledSkillWorkerMock,
  applyGovernanceOverridesMock,
  RuntimeBootstrapServiceMock,
  RuntimeToolsServiceMock,
  RuntimeTaskServiceMock,
  RuntimeCentersQueryServiceMock,
  RuntimeCentersGovernanceServiceMock,
  RuntimeCentersServiceMock,
  autoInstallLocalManifestMock,
  listSkillSourcesMock
} = vi.hoisted(() => ({
  registerInstalledSkillWorkerMock: vi.fn(),
  applyGovernanceOverridesMock: vi.fn(),
  RuntimeBootstrapServiceMock: vi.fn(function (this: unknown, factory: () => unknown) {
    return { factory };
  }),
  RuntimeToolsServiceMock: vi.fn(function (this: unknown, factory: () => unknown) {
    return { factory };
  }),
  RuntimeTaskServiceMock: vi.fn(function (this: unknown, factory: () => unknown) {
    return { factory };
  }),
  RuntimeCentersQueryServiceMock: vi.fn(function (this: unknown, factory: () => unknown) {
    return { factory };
  }),
  RuntimeCentersGovernanceServiceMock: vi.fn(function (this: unknown, factory: () => unknown) {
    return { factory };
  }),
  RuntimeCentersServiceMock: vi.fn(function (
    this: unknown,
    factory: () => unknown,
    queryService: unknown,
    governanceService: unknown
  ) {
    return {
      factory,
      queryService,
      governanceService,
      getRuntimeCenter: vi.fn(() => 'runtime'),
      getApprovalsCenter: vi.fn(() => 'approvals'),
      getLearningCenter: vi.fn(() => 'learning'),
      getEvalsCenter: vi.fn(() => 'evals'),
      getEvidenceCenter: vi.fn(() => 'evidence'),
      getToolsCenter: vi.fn(() => 'tools'),
      getConnectorsCenter: vi.fn(() => 'connectors'),
      getSkillSourcesCenter: vi.fn(() => 'skill-sources'),
      getCompanyAgentsCenter: vi.fn(() => 'company-agents')
    };
  }),
  autoInstallLocalManifestMock: vi.fn(async () => ({ installed: true })),
  listSkillSourcesMock: vi.fn(async () => [{ id: 'source-1' }])
}));

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  applyGovernanceOverrides: applyGovernanceOverridesMock,
  registerInstalledSkillWorker: registerInstalledSkillWorkerMock
}));

vi.mock('../../../src/runtime/services/runtime-bootstrap.service', () => ({
  RuntimeBootstrapService: RuntimeBootstrapServiceMock
}));

vi.mock('../../../src/runtime/services/runtime-tools.service', () => ({
  RuntimeToolsService: RuntimeToolsServiceMock
}));

vi.mock('../../../src/runtime/services/runtime-task.service', () => ({
  RuntimeTaskService: RuntimeTaskServiceMock
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

vi.mock('../../../src/runtime/skills/runtime-skill-install.service', () => ({
  autoInstallLocalManifest: autoInstallLocalManifestMock
}));

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', async () => {
  const actual = await vi.importActual('../../../src/runtime/skills/runtime-skill-sources.service');
  return {
    ...actual,
    listSkillSources: listSkillSourcesMock,
    searchLocalSkillSuggestions: vi.fn(async () => [])
  };
});

import {
  createRuntimeBootstrapService,
  createRuntimeCentersService,
  createRuntimeTaskService,
  createRuntimeToolsService
} from '../../../src/runtime/core/runtime-provider-factories';

describe('runtime-provider-factories extra branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSkillSourcesMock.mockResolvedValue([{ id: 'source-1' }]);
  });

  function createRuntimeHost() {
    return {
      settings: {
        profile: 'personal',
        runtimeBackground: {
          enabled: false,
          runnerIdPrefix: 'runner',
          workerPoolSize: 1,
          leaseTtlMs: 1000,
          heartbeatMs: 500,
          pollMs: 250
        }
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({ governance: { disabledSkillSourceIds: ['source-x'] } }))
      },
      skillRegistry: {
        list: vi.fn(async () => [{ id: 'local-only' }])
      },
      toolRegistry: { id: 'tool-registry' },
      mcpServerRegistry: { id: 'server-registry' },
      mcpCapabilityRegistry: { id: 'capability-registry' },
      mcpClientManager: { id: 'client-manager' },
      orchestrator: { id: 'orchestrator' },
      remoteSkillDiscoveryService: {
        installRemoteSkill: vi.fn(async () => ({ ok: true })),
        checkInstalledSkills: vi.fn(async () => ({ ok: true })),
        updateInstalledSkills: vi.fn(async () => ({ ok: true }))
      },
      skillArtifactFetcher: { id: 'artifact-fetcher' },
      sessionCoordinator: { id: 'session-coordinator' },
      memoryRepository: { id: 'memory' },
      ruleRepository: { id: 'rules' },
      skillSourceSyncService: { id: 'skill-source-sync' }
    } as any;
  }

  it('exposes bootstrap context branches for empty installed-worker sync and background sweep accessors', async () => {
    const runtimeHost = createRuntimeHost();
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map()),
      isBackgroundRunnerSweepInFlight: vi.fn(() => true),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;
    const techBriefingService = {
      initializeSchedule: vi.fn(async () => undefined)
    };
    const runtimeScheduleService = {
      initialize: vi.fn(async () => undefined)
    };

    const bootstrapService = createRuntimeBootstrapService(
      runtimeHost,
      operationalState,
      techBriefingService as any,
      runtimeScheduleService as any
    ) as any;
    const context = bootstrapService.factory();

    await context.syncInstalledSkillWorkers();
    await context.applyStoredGovernanceOverrides();
    await context.initializeDailyTechBriefing();
    await context.initializeScheduleRunner();

    const background = context.getBackgroundRunnerContext();
    expect(registerInstalledSkillWorkerMock).not.toHaveBeenCalled();
    expect(applyGovernanceOverridesMock).toHaveBeenCalledWith(expect.any(Object), {
      governance: { disabledSkillSourceIds: ['source-x'] }
    });
    expect(techBriefingService.initializeSchedule).toHaveBeenCalled();
    expect(runtimeScheduleService.initialize).toHaveBeenCalled();
    expect(background.enabled).toBe(false);
    expect(background.isSweepInFlight()).toBe(true);
    background.setSweepInFlight(false);
    expect(operationalState.setBackgroundRunnerSweepInFlight).toHaveBeenCalledWith(false);
  });

  it('wires task/tools/centers contexts through the expected registries and lazy listSkillSources fallback', async () => {
    const runtimeHost = createRuntimeHost();
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map()),
      isBackgroundRunnerSweepInFlight: vi.fn(() => false),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;

    const taskService = createRuntimeTaskService(runtimeHost) as any;
    const taskContext = taskService.factory();
    expect(taskContext.getBundle?.()).toBeUndefined();

    const toolsService = createRuntimeToolsService(runtimeHost) as any;
    const toolsContext = toolsService.factory();
    expect(toolsContext.getConnectorRegistryContext()).toEqual(
      expect.objectContaining({
        settings: runtimeHost.settings,
        orchestrator: runtimeHost.orchestrator,
        mcpServerRegistry: runtimeHost.mcpServerRegistry
      })
    );

    const bootstrapService = createRuntimeBootstrapService(
      runtimeHost,
      operationalState,
      { initializeSchedule: vi.fn(async () => undefined) } as any,
      { initialize: vi.fn(async () => undefined) } as any
    ) as any;
    const bootstrapContext = bootstrapService.factory();
    const sources = await bootstrapContext.getSkillSourcesContext().listSkillSources();
    await bootstrapContext.getSkillSourcesContext().autoInstallLocalManifest({ id: 'manifest-1' });

    const centersService = createRuntimeCentersService(runtimeHost, operationalState) as any;
    const centersContext = centersService.factory();
    const skillInstallContext = centersContext.getSkillInstallContext();
    const backgroundWorkerSlots = centersContext.getBackgroundWorkerSlots();
    const connectorRegistryContext = centersContext.getConnectorRegistryContext();
    const skillSourcesContext = centersContext.getSkillSourcesContext();
    const platformConsoleContext = centersContext.getPlatformConsoleContext();
    const installResult = await skillInstallContext.remoteSkillCli.install({ repo: 'org/repo', skillName: 'skill-a' });
    const checkResult = await skillInstallContext.remoteSkillCli.check();
    const updateResult = await skillInstallContext.remoteSkillCli.update();
    const listedSkillSources = await skillInstallContext.listSkillSources?.();
    skillInstallContext.registerInstalledSkillWorker({ id: 'skill-1' } as any);
    expect(platformConsoleContext.getLearningCenter()).toBe('learning');
    expect(platformConsoleContext.getEvalsCenter()).toBe('evals');
    expect(platformConsoleContext.getEvidenceCenter()).toBe('evidence');
    expect(platformConsoleContext.getToolsCenter()).toBe('tools');
    expect(platformConsoleContext.getConnectorsCenter()).toBe('connectors');
    expect(platformConsoleContext.getSkillSourcesCenter()).toBe('skill-sources');
    expect(backgroundWorkerSlots).toBeInstanceOf(Map);
    expect(connectorRegistryContext).toEqual(
      expect.objectContaining({
        orchestrator: runtimeHost.orchestrator,
        mcpClientManager: runtimeHost.mcpClientManager
      })
    );
    expect(skillSourcesContext).toEqual(
      expect.objectContaining({
        settings: runtimeHost.settings,
        skillSourceSyncService: runtimeHost.skillSourceSyncService
      })
    );
    expect(installResult).toEqual({ ok: true });
    expect(checkResult).toEqual({ ok: true });
    expect(updateResult).toEqual({ ok: true });
    expect(listedSkillSources).toEqual([{ id: 'source-1' }]);
    expect(runtimeHost.remoteSkillDiscoveryService.installRemoteSkill).toHaveBeenCalledWith({
      repo: 'org/repo',
      skillName: 'skill-a'
    });
    expect(runtimeHost.remoteSkillDiscoveryService.checkInstalledSkills).toHaveBeenCalled();
    expect(runtimeHost.remoteSkillDiscoveryService.updateInstalledSkills).toHaveBeenCalled();
    expect(registerInstalledSkillWorkerMock).toHaveBeenCalledWith(expect.any(Object), { id: 'skill-1' });
    expect(sources).toEqual([{ id: 'source-1' }]);
    expect(autoInstallLocalManifestMock).toHaveBeenCalledWith(expect.any(Object), { id: 'manifest-1' });
  });

  it('falls back to an empty disabled skill source list when governance has no overrides', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.runtimeStateRepository.load = vi.fn(async () => ({}));
    const operationalState = {
      getBackgroundWorkerSlots: vi.fn(() => new Map()),
      isBackgroundRunnerSweepInFlight: vi.fn(() => false),
      setBackgroundRunnerSweepInFlight: vi.fn()
    } as any;

    const bootstrapService = createRuntimeBootstrapService(
      runtimeHost,
      operationalState,
      { initializeSchedule: vi.fn(async () => undefined) } as any,
      { initialize: vi.fn(async () => undefined) } as any
    ) as any;
    const bootstrapContext = bootstrapService.factory();
    const disabledSourceIds = await bootstrapContext.getSkillSourcesContext().getDisabledSkillSourceIds();

    expect(disabledSourceIds).toEqual([]);
  });
});
