import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPlatformConsole,
  resetPlatformConsoleCacheForTest
} from '../../../src/runtime/helpers/runtime-platform-console';

describe('runtime-platform-console cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T09:00:00.000Z'));
    resetPlatformConsoleCacheForTest();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dedupes concurrent platform console requests with the same key', async () => {
    let resolveRuntimeCenter: ((value: unknown) => void) | undefined;
    const getRuntimeCenter = vi.fn(
      () =>
        new Promise(resolve => {
          resolveRuntimeCenter = resolve;
        })
    );
    const context = createPlatformConsoleContext({
      getRuntimeCenter
    });

    const first = buildPlatformConsole(context, 30, {
      status: 'running'
    });
    const second = buildPlatformConsole(context, 30, {
      status: 'running'
    });

    expect(getRuntimeCenter).toHaveBeenCalledTimes(1);

    resolveRuntimeCenter?.({
      scope: 'runtime'
    });

    await expect(first).resolves.toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({ scope: 'runtime' })
      })
    );
    await expect(second).resolves.toEqual(
      expect.objectContaining({
        runtime: expect.objectContaining({ scope: 'runtime' })
      })
    );
    expect(getRuntimeCenter).toHaveBeenCalledTimes(1);
  });

  it('reuses cached platform console results within the ttl window', async () => {
    const getRuntimeCenter = vi
      .fn()
      .mockResolvedValueOnce({ scope: 'runtime', revision: 1 })
      .mockResolvedValueOnce({ scope: 'runtime', revision: 2 });
    const context = createPlatformConsoleContext({
      getRuntimeCenter
    });

    const first = await buildPlatformConsole(context, 30, {
      status: 'running'
    });

    vi.advanceTimersByTime(10_000);

    const second = await buildPlatformConsole(context, 30, {
      status: 'running'
    });

    expect(first.runtime).toEqual(expect.objectContaining({ scope: 'runtime', revision: 1 }));
    expect(second.runtime).toEqual(expect.objectContaining({ scope: 'runtime', revision: 1 }));
    expect(getRuntimeCenter).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached results after the ttl window and when filters change', async () => {
    const getRuntimeCenter = vi
      .fn()
      .mockResolvedValueOnce({ scope: 'runtime', revision: 1 })
      .mockResolvedValueOnce({ scope: 'runtime', revision: 2 })
      .mockResolvedValueOnce({ scope: 'runtime', revision: 3 });
    const context = createPlatformConsoleContext({
      getRuntimeCenter
    });

    const first = await buildPlatformConsole(context, 30, {
      status: 'running'
    });

    vi.advanceTimersByTime(16_000);

    const afterTtl = await buildPlatformConsole(context, 30, {
      status: 'running'
    });
    const differentFilter = await buildPlatformConsole(context, 30, {
      status: 'waiting_approval'
    });

    expect(first.runtime).toEqual(expect.objectContaining({ scope: 'runtime', revision: 1 }));
    expect(afterTtl.runtime).toEqual(expect.objectContaining({ scope: 'runtime', revision: 2 }));
    expect(differentFilter.runtime).toEqual(expect.objectContaining({ scope: 'runtime', revision: 3 }));
    expect(getRuntimeCenter).toHaveBeenCalledTimes(3);
  });
});

function createPlatformConsoleContext(overrides?: { getRuntimeCenter?: ReturnType<typeof vi.fn> }) {
  return {
    skillRegistry: {
      list: vi.fn(async () => [])
    },
    orchestrator: {
      listRules: vi.fn(async () => []),
      listTasks: vi.fn(() => [])
    },
    sessionCoordinator: {
      listSessions: vi.fn(() => []),
      getCheckpoint: vi.fn(() => undefined)
    },
    getRuntimeCenter: overrides?.getRuntimeCenter ?? vi.fn(async () => ({ scope: 'runtime' })),
    getApprovalsCenter: vi.fn(() => []),
    getLearningCenter: vi.fn(async () => ({
      totalCandidates: 0,
      pendingCandidates: 0,
      confirmedCandidates: 0,
      candidates: []
    })),
    getEvalsCenter: vi.fn(async () => ({
      dailyTrend: [],
      persistedDailyHistory: [],
      recentRuns: [],
      promptRegression: { suites: [] }
    })),
    getEvidenceCenter: vi.fn(async () => ({
      totalEvidenceCount: 0,
      recentEvidence: []
    })),
    getConnectorsCenter: vi.fn(async () => []),
    getSkillSourcesCenter: vi.fn(async () => ({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    })),
    getCompanyAgentsCenter: vi.fn(() => [])
  };
}
