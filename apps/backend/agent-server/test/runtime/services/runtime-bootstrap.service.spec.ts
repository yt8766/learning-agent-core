import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/runtime/helpers/runtime-background-runner', () => ({
  startBackgroundRunnerLoop: vi.fn(() => ({ unref: vi.fn() })),
  runBackgroundRunnerTick: vi.fn(async () => undefined)
}));

import { startBackgroundRunnerLoop } from '../../../src/runtime/helpers/runtime-background-runner';
import { RuntimeBootstrapService } from '../../../src/runtime/services/runtime-bootstrap.service';
import { resolveTaskSkillSearch } from '../../../src/runtime/skills/runtime-skill-sources.service';

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../src/runtime/skills/runtime-skill-sources.service')>();
  return {
    ...actual,
    resolveTaskSkillSearch: vi.fn(async () => ({
      capabilityGapDetected: false,
      suggestions: [{ id: 'skill-1', displayName: 'Skill One' }]
    }))
  };
});

describe('RuntimeBootstrapService', () => {
  it('禁用 runtime background 时不会启动内建 runner', async () => {
    const service = new RuntimeBootstrapService(() => ({
      sessionCoordinator: { initialize: vi.fn(async () => undefined) },
      orchestrator: { setLocalSkillSuggestionResolver: vi.fn() },
      getSkillSourcesContext: () =>
        ({
          settings: {
            workspaceRoot: '/tmp/workspace',
            skillsRoot: '/tmp/skills-managed',
            profile: 'platform',
            skillSourcesRoot: '/tmp/skills',
            policy: { sourcePolicyMode: 'controlled-first', skillInstallMode: 'manual' }
          },
          toolRegistry: { get: vi.fn(() => undefined) },
          skillRegistry: { list: vi.fn(async () => []) },
          skillSourceSyncService: {
            readCachedSyncState: vi.fn(async () => undefined),
            readCachedManifests: vi.fn(async () => []),
            syncSource: vi.fn(async () => undefined)
          },
          remoteSkillDiscoveryService: {
            discover: vi.fn(async () => ({
              capabilityGapDetected: false,
              suggestions: []
            }))
          },
          getDisabledSkillSourceIds: vi.fn(async () => [])
        }) as never,
      syncInstalledSkillWorkers: vi.fn(async () => undefined),
      applyStoredGovernanceOverrides: vi.fn(async () => undefined),
      initializeMetricsSnapshots: vi.fn(async () => undefined),
      initializeDailyTechBriefing: vi.fn(async () => undefined),
      initializeScheduleRunner: vi.fn(async () => undefined),
      getBackgroundRunnerContext: () =>
        ({
          enabled: false,
          orchestrator: {},
          runnerId: 'runtime-test',
          workerPoolSize: 2,
          leaseTtlMs: 30000,
          heartbeatMs: 10000,
          pollMs: 3000,
          backgroundWorkerSlots: new Map(),
          isSweepInFlight: () => false,
          setSweepInFlight: vi.fn()
        }) as never
    }));

    await service.initialize();

    expect(startBackgroundRunnerLoop).not.toHaveBeenCalled();
  });

  it('warms metrics snapshots after bootstrap without blocking initialization success', async () => {
    const initializeMetricsSnapshots = vi.fn(async () => undefined);
    const service = new RuntimeBootstrapService(() => ({
      sessionCoordinator: { initialize: vi.fn(async () => undefined) },
      orchestrator: { setLocalSkillSuggestionResolver: vi.fn() },
      getSkillSourcesContext: () =>
        ({
          settings: {
            workspaceRoot: '/tmp/workspace',
            skillsRoot: '/tmp/skills-managed',
            profile: 'platform',
            skillSourcesRoot: '/tmp/skills',
            policy: { sourcePolicyMode: 'controlled-first', skillInstallMode: 'manual' }
          },
          toolRegistry: { get: vi.fn(() => undefined) },
          skillRegistry: { list: vi.fn(async () => []) },
          skillSourceSyncService: {
            readCachedSyncState: vi.fn(async () => undefined),
            readCachedManifests: vi.fn(async () => []),
            syncSource: vi.fn(async () => undefined)
          },
          remoteSkillDiscoveryService: {
            discover: vi.fn(async () => ({
              capabilityGapDetected: false,
              suggestions: []
            }))
          },
          getDisabledSkillSourceIds: vi.fn(async () => [])
        }) as never,
      syncInstalledSkillWorkers: vi.fn(async () => undefined),
      applyStoredGovernanceOverrides: vi.fn(async () => undefined),
      initializeMetricsSnapshots,
      initializeDailyTechBriefing: vi.fn(async () => undefined),
      initializeScheduleRunner: vi.fn(async () => undefined),
      getBackgroundRunnerContext: () =>
        ({
          enabled: false,
          orchestrator: {},
          runnerId: 'runtime-test',
          workerPoolSize: 2,
          leaseTtlMs: 30000,
          heartbeatMs: 10000,
          pollMs: 3000,
          backgroundWorkerSlots: new Map(),
          isSweepInFlight: () => false,
          setSweepInFlight: vi.fn()
        }) as never
    }));

    await service.initialize();

    expect(initializeMetricsSnapshots).toHaveBeenCalledTimes(1);
  });

  it('registers the local skill suggestion resolver with real task-skill search', async () => {
    const setLocalSkillSuggestionResolver = vi.fn();
    const service = new RuntimeBootstrapService(() => ({
      sessionCoordinator: { initialize: vi.fn(async () => undefined) },
      orchestrator: { setLocalSkillSuggestionResolver },
      getSkillSourcesContext: () =>
        ({
          settings: {
            workspaceRoot: '/tmp/workspace',
            skillsRoot: '/tmp/skills-managed',
            profile: 'platform',
            skillSourcesRoot: '/tmp/skills',
            policy: { sourcePolicyMode: 'controlled-first', skillInstallMode: 'manual' }
          },
          toolRegistry: { get: vi.fn(() => undefined) },
          skillRegistry: { list: vi.fn(async () => []) },
          skillSourceSyncService: {
            readCachedSyncState: vi.fn(async () => undefined),
            readCachedManifests: vi.fn(async () => []),
            syncSource: vi.fn(async () => undefined)
          },
          remoteSkillDiscoveryService: {
            discover: vi.fn(async () => ({
              capabilityGapDetected: false,
              suggestions: []
            }))
          },
          getDisabledSkillSourceIds: vi.fn(async () => [])
        }) as never,
      syncInstalledSkillWorkers: vi.fn(async () => undefined),
      applyStoredGovernanceOverrides: vi.fn(async () => undefined),
      initializeMetricsSnapshots: vi.fn(async () => undefined),
      initializeDailyTechBriefing: vi.fn(async () => undefined),
      initializeScheduleRunner: vi.fn(async () => undefined),
      getBackgroundRunnerContext: () =>
        ({
          enabled: false,
          orchestrator: {},
          runnerId: 'runtime-test',
          workerPoolSize: 2,
          leaseTtlMs: 30000,
          heartbeatMs: 10000,
          pollMs: 3000,
          backgroundWorkerSlots: new Map(),
          isSweepInFlight: () => false,
          setSweepInFlight: vi.fn()
        }) as never
    }));

    await service.initialize();

    expect(setLocalSkillSuggestionResolver).toHaveBeenCalledTimes(1);
    const resolver = setLocalSkillSuggestionResolver.mock.calls[0]?.[0];
    expect(typeof resolver).toBe('function');

    const result = await resolver({
      goal: 'Find a skill to review runtime logs',
      usedInstalledSkills: ['skill-a'],
      requestedHints: { executionMode: 'plan' },
      specialistDomain: 'operations'
    });

    expect(resolveTaskSkillSearch).toHaveBeenCalledWith(expect.any(Object), 'Find a skill to review runtime logs', {
      usedInstalledSkills: ['skill-a'],
      requestedHints: { executionMode: 'plan' },
      specialistDomain: 'operations'
    });
    expect(result).toEqual(
      expect.objectContaining({
        capabilityGapDetected: false,
        suggestions: [expect.objectContaining({ id: 'skill-1' })]
      })
    );
  });
});
