import { describe, expect, it } from 'vitest';
import { buildCompanyAgentsCenter } from '../src/runtime/runtime-company-agents-center';

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
});
