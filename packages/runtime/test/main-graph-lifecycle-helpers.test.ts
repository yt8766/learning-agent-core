import { describe, expect, it } from 'vitest';

import { ActionIntent, TaskStatus } from '@agent/shared';

import {
  buildSkillInstallPendingExecution,
  enforceInterruptControllerPolicy,
  finalizeLifecycleTaskState
} from '../src/graphs/main/lifecycle/main-graph-lifecycle-persistence';
import {
  isSkillInstallApprovalPending,
  resolveCreatedTaskDispatch
} from '../src/graphs/main/lifecycle/main-graph-lifecycle-routing';

describe('main graph lifecycle helpers', () => {
  it('routes created tasks by waiting approval, session flow, and background flow', () => {
    expect(
      resolveCreatedTaskDispatch({
        status: TaskStatus.WAITING_APPROVAL
      } as never)
    ).toEqual({ kind: 'wait_approval' });

    expect(
      resolveCreatedTaskDispatch({
        status: TaskStatus.QUEUED,
        sessionId: 'session-1'
      } as never)
    ).toEqual({ kind: 'session_bootstrap_and_pipeline' });

    expect(
      resolveCreatedTaskDispatch({
        status: TaskStatus.QUEUED
      } as never)
    ).toEqual({ kind: 'background_queue' });
  });

  it('detects pending skill install approvals and builds pending execution context from approval trace', () => {
    const task = {
      id: 'task-1',
      goal: 'install a skill',
      status: TaskStatus.WAITING_APPROVAL,
      pendingApproval: {
        intent: ActionIntent.INSTALL_SKILL,
        toolName: 'npx skills add'
      },
      trace: [
        {
          node: 'approval_gate',
          data: {
            receiptId: 'receipt-1',
            skillDisplayName: 'Structured Output Skill'
          }
        }
      ],
      usedInstalledSkills: ['local-skill']
    } as never;

    expect(isSkillInstallApprovalPending(task)).toBe(true);
    expect(buildSkillInstallPendingExecution(task, 'install a skill')).toMatchObject({
      taskId: 'task-1',
      receiptId: 'receipt-1',
      skillDisplayName: 'Structured Output Skill'
    });
  });

  it('interrupt controller blocks non-counselor proxy user input and truncates counselor proxy questions', () => {
    const traces: Array<{ node: string; summary: string; data?: Record<string, unknown> }> = [];
    const addTrace = (_trace: unknown, node: string, summary: string, data?: Record<string, unknown>) =>
      traces.push({ node, summary, data });

    const blockedTask = {
      trace: [],
      activeInterrupt: {
        id: 'interrupt-1',
        kind: 'user-input',
        origin: 'runtime',
        proxySourceAgentId: 'sub-agent-1',
        status: 'pending',
        createdAt: '2026-04-16T00:00:00.000Z'
      }
    } as never;
    enforceInterruptControllerPolicy({
      task: blockedTask,
      addTrace
    });
    expect(blockedTask.activeInterrupt).toBeUndefined();
    expect(traces.at(-1)?.node).toBe('interrupt_proxy_violation');

    const counselorTask = {
      trace: [],
      activeInterrupt: {
        id: 'interrupt-2',
        kind: 'user-input',
        origin: 'counselor_proxy',
        status: 'pending',
        interactionKind: 'plan-question',
        payload: {
          questions: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        },
        createdAt: '2026-04-16T00:00:00.000Z'
      }
    } as never;
    enforceInterruptControllerPolicy({
      task: counselorTask,
      addTrace
    });
    expect((counselorTask.activeInterrupt?.payload as { questions: unknown[] }).questions).toHaveLength(3);
    expect(traces.at(-1)?.node).toBe('interrupt_controller');
  });

  it('finalizes partial aggregation only for terminal tasks', () => {
    const task = {
      status: TaskStatus.COMPLETED,
      partialAggregation: {
        status: 'ready'
      },
      internalSubAgents: ['agent-a']
    } as never;

    finalizeLifecycleTaskState(task);

    expect(task.partialAggregation).toBeUndefined();
    expect(task.internalSubAgents).toBeUndefined();
  });
});
