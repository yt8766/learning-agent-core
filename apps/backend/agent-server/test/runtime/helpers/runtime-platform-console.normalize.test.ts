import { describe, expect, it, vi } from 'vitest';

import { buildPlatformConsole } from '../../../src/runtime/helpers/runtime-platform-console';

describe('runtime-platform-console normalization helpers', () => {
  it('normalizes malformed runtime, evals, and evidence payloads at the platform-console boundary', async () => {
    const context = {
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
      getRuntimeCenter: vi.fn(async () => ({
        taskCount: 2,
        usageAnalytics: {
          daily: 'invalid-daily-history'
        },
        recentRuns: 'invalid-recent-runs'
      })),
      getApprovalsCenter: vi.fn(() => []),
      getLearningCenter: vi.fn(async () => ({
        totalCandidates: 0,
        pendingCandidates: 0,
        confirmedCandidates: 0,
        candidates: []
      })),
      getEvalsCenter: vi.fn(async () => ({
        dailyTrend: 'invalid-daily-trend',
        recentRuns: 'invalid-recent-runs',
        promptRegression: {
          suites: 'invalid-suites'
        }
      })),
      getEvidenceCenter: vi.fn(async () => ({
        totalEvidenceCount: 'invalid-count',
        recentEvidence: 'invalid-recent-evidence'
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

    const consoleRecord = await buildPlatformConsole(context, 30);

    expect(consoleRecord.runtime).toEqual(
      expect.objectContaining({
        taskCount: 2,
        usageAnalytics: expect.objectContaining({
          daily: [],
          persistedDailyHistory: []
        }),
        recentRuns: []
      })
    );
    expect(consoleRecord.evals).toEqual(
      expect.objectContaining({
        dailyTrend: [],
        persistedDailyHistory: [],
        recentRuns: [],
        promptRegression: expect.objectContaining({
          suites: []
        })
      })
    );
    expect(consoleRecord.evidence).toEqual({
      totalEvidenceCount: 0,
      recentEvidence: []
    });
  });
});
