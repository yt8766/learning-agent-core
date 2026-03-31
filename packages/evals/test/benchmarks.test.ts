import { describe, expect, it } from 'vitest';

import { TaskStatus } from '@agent/shared';

import { evaluateBenchmarks } from '../src/benchmarks';

describe('evaluateBenchmarks', () => {
  it('生成 review 与 research reuse 的 benchmark 汇总', () => {
    const summary = evaluateBenchmarks([
      {
        id: 'task-review',
        goal: '请审查这个仓库',
        status: TaskStatus.COMPLETED,
        skillId: 'review',
        trace: [{ node: 'review', at: '2026-03-24T00:00:00.000Z', summary: 'review completed' }],
        approvals: [],
        agentStates: [],
        messages: [],
        externalSources: [],
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z'
      },
      {
        id: 'task-reuse',
        goal: '复用历史研究',
        status: TaskStatus.COMPLETED,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [],
        reusedMemories: ['mem-1'],
        externalSources: [
          {
            id: 'evidence-1',
            taskId: 'task-reuse',
            sourceType: 'memory_reuse',
            trustClass: 'internal',
            summary: '已命中 research memory',
            createdAt: '2026-03-24T00:00:00.000Z'
          }
        ],
        createdAt: '2026-03-24T00:00:00.000Z',
        updatedAt: '2026-03-24T00:00:00.000Z'
      }
    ] as any);

    expect(summary.scenarioCount).toBeGreaterThan(0);
    expect(summary.recentRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-review',
          success: true
        }),
        expect.objectContaining({
          taskId: 'task-reuse',
          success: true
        })
      ])
    );
    expect(summary.dailyTrend).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          day: '2026-03-24',
          runCount: 2,
          passCount: 2
        })
      ])
    );
    expect(summary.scenarioTrends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'review'
        }),
        expect.objectContaining({
          scenarioId: 'research-reuse'
        })
      ])
    );
    expect(summary.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'review',
          passCount: 1
        }),
        expect.objectContaining({
          scenarioId: 'research-reuse',
          passCount: 1
        })
      ])
    );
  });
});
