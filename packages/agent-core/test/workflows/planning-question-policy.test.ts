import { describe, expect, it } from 'vitest';

import { TaskStatus, type TaskRecord } from '@agent/shared';

import { buildPlanningPolicy } from '../../src/workflows/planning-question-policy';

function createTask(workflowId: string, displayName: string): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: `task-${workflowId}`,
    goal: displayName,
    status: TaskStatus.QUEUED,
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    resolvedWorkflow: {
      id: workflowId,
      displayName,
      requiredMinistries: ['libu-router'],
      allowedCapabilities: [],
      approvalPolicy: 'high-risk-only',
      intentPatterns: [],
      outputContract: { type: 'summary', requiredSections: ['summary'] }
    },
    createdAt: now,
    updatedAt: now
  } as any as TaskRecord;
}

describe('planning-question-policy', () => {
  it('builds engineering-review policy with richer question set and default readonly budget', () => {
    const task = createTask('plan-eng-review', '工程方案评审');

    const policy = buildPlanningPolicy(task, {
      goal: '/plan-eng-review 为 agent-chat 增加计划模式',
      sessionId: 'session:test'
    });

    expect(policy.scenario).toBe('engineering-review');
    expect(policy.questionSet.title).toBe('工程方案确认');
    expect(policy.questions.map(item => item.questionType)).toEqual(['direction', 'detail', 'tradeoff']);
    expect(policy.microBudget.readOnlyToolLimit).toBe(3);
    expect(policy.autoResolved).toEqual(expect.arrayContaining(['已命中流程模板：工程方案评审']));
  });

  it('uses tighter readonly budget for qa planning', () => {
    const task = createTask('qa', '测试验证');

    const policy = buildPlanningPolicy(task, {
      goal: '先给我一份 QA 方案',
      sessionId: 'session:test'
    });

    expect(policy.scenario).toBe('qa');
    expect(policy.questionSet.title).toBe('测试策略确认');
    expect(policy.microBudget.readOnlyToolLimit).toBe(2);
    expect(policy.questions).toHaveLength(1);
    expect(policy.questions[0]?.questionType).toBe('direction');
  });
});
