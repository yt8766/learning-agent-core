import { describe, expect, it } from 'vitest';

import {
  buildExecutionStepSummary,
  initializeTaskExecutionSteps,
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepResumed,
  markExecutionStepStarted
} from '../src';
import type { TaskRecord } from '../src';

function createTask(): TaskRecord {
  return {
    id: 'task-1',
    goal: '修复页面状态问题',
    status: 'queued',
    createdAt: '2026-04-16T00:00:00.000Z',
    updatedAt: '2026-04-16T00:00:00.000Z',
    trace: [],
    messages: [],
    modelRoute: [],
    chatRoute: {
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'modification_intent',
      adapter: 'modification-intent',
      priority: 70,
      intent: 'workflow-execute',
      intentConfidence: 0.9,
      executionReadiness: 'ready',
      matchedSignals: ['workflow-execute']
    }
  } as TaskRecord;
}

describe('shared execution step helpers', () => {
  it('initializes templated step summaries from chat route', () => {
    const task = createTask();

    initializeTaskExecutionSteps(task);

    expect(task.chatRoute?.stepsSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'request-received', status: 'pending' }),
        expect.objectContaining({ stage: 'execution', status: 'pending' }),
        expect.objectContaining({ stage: 'delivery', status: 'pending' })
      ])
    );
  });

  it('tracks started, blocked, resumed, and completed states on the same task', () => {
    const task = createTask();

    markExecutionStepStarted(task, 'research', '户部开始整理资料。', 'hubu');
    markExecutionStepBlocked(task, 'research', '等待补充上下文', '研究链暂停。', 'hubu');
    markExecutionStepResumed(task, 'research', '已收到补充上下文。', 'hubu');
    markExecutionStepCompleted(task, 'research', '户部已完成研究。', 'hubu');

    expect(task.executionSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'research',
          status: 'completed',
          owner: 'hubu',
          detail: '户部已完成研究。',
          completedAt: expect.any(String)
        })
      ])
    );
    expect(task.currentExecutionStep).toEqual(
      expect.objectContaining({
        stage: 'research',
        status: 'completed'
      })
    );
  });

  it('builds summary rows for approval-recovery routes', () => {
    const summary = buildExecutionStepSummary('approval-recovery', []);

    expect(summary.map(item => item.stage)).toEqual([
      'request-received',
      'route-selection',
      'approval-interrupt',
      'recovery',
      'execution',
      'review',
      'delivery'
    ]);
  });
});
