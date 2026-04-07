import { describe, expect, it } from 'vitest';

import { buildCompanyAgentsCenter } from '../../../src/runtime/centers/runtime-company-agents-center';

describe('buildCompanyAgentsCenter', () => {
  it('builds company worker summaries from related task history', () => {
    const center = buildCompanyAgentsCenter({
      workers: [
        { id: 'worker-company', kind: 'company', name: 'Company Worker', requiredConnectors: ['slack'] },
        { id: 'worker-ready', kind: 'company', name: 'Ready Worker' },
        { id: 'worker-human', kind: 'human', name: 'Human Worker' }
      ],
      tasks: [
        {
          id: 'task-running',
          currentWorker: 'worker-company',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T09:00:00.000Z',
          status: 'running',
          goal: 'Investigate deployment drift',
          runId: 'run-1'
        },
        {
          id: 'task-completed',
          currentWorker: 'worker-company',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T08:00:00.000Z',
          status: 'completed',
          goal: 'Publish runtime report',
          runId: 'run-2'
        },
        {
          id: 'task-failed',
          currentWorker: 'worker-company',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T07:00:00.000Z',
          status: 'failed',
          goal: 'Retry flaky migration',
          runId: 'run-2'
        },
        {
          id: 'task-shared',
          currentWorker: 'worker-ready',
          usedCompanyWorkers: ['worker-company'],
          updatedAt: '2026-04-01T06:00:00.000Z',
          status: 'cancelled',
          goal: 'Cross-check connector mapping',
          runId: 'run-3'
        },
        {
          id: 'task-ready',
          currentWorker: 'worker-ready',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T05:00:00.000Z',
          status: 'queued',
          goal: 'Bootstrap onboarding workspace',
          runId: 'run-4'
        }
      ],
      disabledWorkerIds: new Set(['worker-company'])
    });

    expect(center).toHaveLength(2);
    expect(center[0]).toMatchObject({
      id: 'worker-company',
      enabled: false,
      activeTaskCount: 1,
      totalTaskCount: 4,
      promotionState: 'needs-review',
      governanceStatus: 'disabled',
      recentTaskGoals: ['Investigate deployment drift', 'Publish runtime report', 'Retry flaky migration']
    });
    expect(center[0].successRate).toBeCloseTo(1 / 3);
    expect(center[0].sourceRuns).toEqual(['run-1', 'run-2', 'run-3']);

    expect(center[1]).toMatchObject({
      id: 'worker-ready',
      enabled: true,
      activeTaskCount: 1,
      totalTaskCount: 2,
      promotionState: 'needs-review',
      governanceStatus: 'ready',
      recentTaskGoals: ['Cross-check connector mapping', 'Bootstrap onboarding workspace']
    });
    expect(center[1].successRate).toBe(0);
  });

  it('marks connector-bound workers and warming workers without completed history', () => {
    const center = buildCompanyAgentsCenter({
      workers: [
        { id: 'worker-connector', kind: 'company', requiredConnectors: ['github'] },
        { id: 'worker-warming', kind: 'company', requiredConnectors: [] }
      ],
      tasks: [
        {
          id: 'task-blocked',
          currentWorker: 'worker-connector',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T09:00:00.000Z',
          status: 'blocked',
          goal: 'Wait for approval'
        },
        {
          id: 'task-pending',
          currentWorker: 'worker-warming',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T08:00:00.000Z',
          status: 'running',
          goal: 'Prepare proposal'
        }
      ],
      disabledWorkerIds: new Set()
    });

    expect(center[0]).toMatchObject({
      id: 'worker-connector',
      governanceStatus: 'connector-bound',
      promotionState: 'warming',
      activeTaskCount: 1,
      totalTaskCount: 1
    });
    expect(center[0].successRate).toBeUndefined();

    expect(center[1]).toMatchObject({
      id: 'worker-warming',
      governanceStatus: 'ready',
      promotionState: 'warming',
      activeTaskCount: 1,
      totalTaskCount: 1
    });
    expect(center[1].successRate).toBeUndefined();
  });

  it('marks validated workers when completion ratio stays above the promotion threshold', () => {
    const center = buildCompanyAgentsCenter({
      workers: [{ id: 'worker-validated', kind: 'company', requiredConnectors: [] }],
      tasks: [
        {
          id: 'task-success-1',
          currentWorker: 'worker-validated',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T09:00:00.000Z',
          status: 'completed',
          goal: 'Deliver governance report',
          runId: 'run-1'
        },
        {
          id: 'task-success-2',
          currentWorker: 'worker-validated',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T08:00:00.000Z',
          status: 'completed',
          goal: 'Review approvals',
          runId: 'run-1'
        },
        {
          id: 'task-failed-1',
          currentWorker: 'worker-validated',
          usedCompanyWorkers: [],
          updatedAt: '2026-04-01T07:00:00.000Z',
          status: 'failed',
          goal: 'Retry sync',
          runId: 'run-2'
        }
      ],
      disabledWorkerIds: new Set()
    });

    expect(center).toEqual([
      expect.objectContaining({
        id: 'worker-validated',
        enabled: true,
        promotionState: 'warming',
        governanceStatus: 'ready',
        totalTaskCount: 3
      })
    ]);
    expect(center[0]?.successRate).toBeCloseTo(2 / 3);
  });
});
