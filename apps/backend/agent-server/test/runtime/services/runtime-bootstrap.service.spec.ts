import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/runtime/helpers/runtime-background-runner', () => ({
  startBackgroundRunnerLoop: vi.fn(() => ({ unref: vi.fn() })),
  runBackgroundRunnerTick: vi.fn(async () => undefined)
}));

import { startBackgroundRunnerLoop } from '../../../src/runtime/helpers/runtime-background-runner';
import { RuntimeBootstrapService } from '../../../src/runtime/services/runtime-bootstrap.service';

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
});
