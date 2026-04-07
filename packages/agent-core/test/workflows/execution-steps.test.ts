import { describe, expect, it } from 'vitest';

import type { TaskRecord } from '@agent/shared';
import {
  buildExecutionStepSummary,
  initializeTaskExecutionSteps,
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepResumed,
  markExecutionStepStarted
} from '../../src/workflows/execution-steps';

function createTask(routeIntent: NonNullable<NonNullable<TaskRecord['chatRoute']>['intent']>): TaskRecord {
  return {
    id: 'task-1',
    goal: 'test',
    status: 'running' as TaskRecord['status'],
    trace: [],
    approvals: [],
    agentStates: [],
    messages: [],
    createdAt: '2026-04-07T00:00:00.000Z',
    updatedAt: '2026-04-07T00:00:00.000Z',
    chatRoute: {
      graph: 'workflow',
      flow:
        routeIntent === 'direct-reply'
          ? 'direct-reply'
          : routeIntent === 'approval-recovery'
            ? 'approval'
            : 'supervisor',
      reason: 'test',
      adapter: 'general-prompt',
      priority: 50,
      intent: routeIntent
    }
  } as TaskRecord;
}

describe('execution step workflow helpers', () => {
  it('builds pending template by route', () => {
    expect(buildExecutionStepSummary('direct-reply', []).map(step => step.stage)).toEqual([
      'request-received',
      'route-selection',
      'research',
      'delivery'
    ]);
    expect(buildExecutionStepSummary('research-first', []).map(step => step.stage)).toEqual([
      'request-received',
      'route-selection',
      'task-planning',
      'research',
      'delivery'
    ]);
    expect(buildExecutionStepSummary('workflow-execute', []).map(step => step.stage)).toEqual([
      'request-received',
      'route-selection',
      'task-planning',
      'research',
      'execution',
      'review',
      'delivery'
    ]);
    expect(buildExecutionStepSummary('approval-recovery', []).map(step => step.stage)).toEqual([
      'request-received',
      'route-selection',
      'approval-interrupt',
      'recovery',
      'execution',
      'review',
      'delivery'
    ]);
    expect(buildExecutionStepSummary('workflow-execute', []).every(step => step.status === 'pending')).toBe(true);
  });

  it('updates task execution steps and route summary', () => {
    const task = createTask('workflow-execute');
    initializeTaskExecutionSteps(task);

    markExecutionStepStarted(task, 'research', '户部开始检索。');
    markExecutionStepBlocked(task, 'approval-interrupt', '等待审批。');
    markExecutionStepResumed(task, 'recovery', '审批通过后恢复。');
    markExecutionStepCompleted(task, 'delivery', '礼部已整理交付。');

    expect(task.currentExecutionStep?.stage).toBe('delivery');
    expect(task.executionSteps?.map(step => step.stage)).toEqual([
      'research',
      'approval-interrupt',
      'recovery',
      'delivery'
    ]);
    expect(
      task.chatRoute?.stepsSummary?.some(step => step.stage === 'task-planning' && step.status === 'pending')
    ).toBe(true);
    expect(task.chatRoute?.stepsSummary?.find(step => step.stage === 'approval-interrupt')?.reason).toBe('等待审批。');
  });

  it('rebuilds summary when route changes so old template is not reused', () => {
    const task = createTask('workflow-execute');
    initializeTaskExecutionSteps(task);
    markExecutionStepStarted(task, 'execution', '工部开始执行。');

    task.chatRoute = {
      ...task.chatRoute!,
      flow: 'approval',
      intent: 'approval-recovery'
    };
    initializeTaskExecutionSteps(task);

    expect(task.chatRoute?.stepsSummary?.map(step => step.stage)).toEqual([
      'request-received',
      'route-selection',
      'approval-interrupt',
      'recovery',
      'execution',
      'review',
      'delivery'
    ]);
    expect(task.chatRoute?.stepsSummary?.some(step => step.stage === 'task-planning')).toBe(false);
    expect(task.chatRoute?.stepsSummary?.find(step => step.stage === 'execution')?.status).toBe('pending');
  });
});
