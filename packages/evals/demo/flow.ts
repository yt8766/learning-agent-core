import { TaskStatus } from '@agent/core';

import { evaluateBenchmarks } from '../src/index.js';

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
] as never[]);

console.log(
  JSON.stringify(
    {
      scenarioCount: summary.scenarioCount,
      recentRuns: summary.recentRuns.map(run => ({
        taskId: run.taskId,
        success: run.success
      })),
      dailyTrend: summary.dailyTrend
    },
    null,
    2
  )
);
