import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskDetailPanel } from '@/pages/task-traces/task-detail-panel';

import type { TaskBundle } from '@/types/admin';

const bundle: TaskBundle = {
  task: {
    id: 'task_001',
    goal: '诊断运行时问题',
    status: 'running',
    currentStep: 'ResultAggregator',
    retryCount: 1,
    maxRetries: 3,
    result: '已完成初步分析',
    resolvedWorkflow: { id: 'runtime-workflow', displayName: 'Runtime Workflow', version: '2.0.0' },
    subgraphTrail: ['execution', 'review'],
    dispatches: [
      {
        taskId: 'task_001',
        subTaskId: 'subtask_1',
        from: 'manager',
        to: 'reviewer',
        kind: 'ministry',
        objective: '汇总风险并确认结论',
        selectedAgentId: 'official.reviewer'
      }
    ],
    approvals: [],
    updatedAt: '2026-03-30T12:00:02Z',
    createdAt: '2026-03-30T11:59:50Z'
  },
  plan: {
    id: 'plan_001',
    summary: '汇总 runtime trace 并输出风险结论',
    steps: ['拉取 trace', '汇总风险'],
    subTasks: [
      { id: 'subtask_1', title: '终审', description: '汇总风险并确认结论', assignedTo: 'reviewer', status: 'done' }
    ]
  },
  review: { taskId: 'task_001', decision: 'pass', notes: ['评审通过'] },
  messages: [
    {
      id: 'm1',
      from: 'system',
      to: 'user',
      type: 'status',
      content: '已进入汇总阶段',
      createdAt: '2026-03-30T12:00:00Z'
    }
  ],
  traces: [{ node: 'ResultAggregator', at: '2026-03-30T12:00:00Z', summary: '汇总执行证据' }],
  audit: {
    taskId: 'task_001',
    entries: [{ id: 'a1', type: 'governance', title: 'review', at: '2026-03-30T12:00:01Z', summary: '评审通过' }],
    browserReplays: []
  },
  agents: [
    {
      agentId: 'agent_1',
      role: 'reviewer',
      goal: '完成终审',
      status: 'idle',
      subTask: '终审',
      plan: ['核对 trace', '确认结论'],
      toolCalls: [],
      observations: ['治理评分稳定'],
      shortTermMemory: []
    }
  ]
};

describe('TaskDetailPanel', () => {
  it('renders task sections with dashboard cards', () => {
    const html = renderToStaticMarkup(<TaskDetailPanel bundle={bundle} />);
    expect(html).toContain('任务详情');
    expect(html).toContain('消息流');
    expect(html).toContain('执行轨迹');
    expect(html).toContain('Agent 状态');
    expect(html).toContain('official.reviewer');
    expect(html).toContain('border-border/70');
  });
});
