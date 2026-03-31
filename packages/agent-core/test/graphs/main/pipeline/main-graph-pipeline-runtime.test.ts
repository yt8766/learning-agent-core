import { describe, expect, it } from 'vitest';
import { AgentRole, TaskStatus, type TaskRecord } from '@agent/shared';

import { runExecuteStage } from '../../../../src/graphs/main/pipeline/main-graph-pipeline-runtime';
import {
  buildCurrentSkillExecution,
  resolveExecutionDispatchObjective,
  resolveResearchDispatchObjective
} from '../../../../src/graphs/main/pipeline/main-graph-pipeline-runtime-helpers';

function createTask(): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task_runtime_skill_step',
    goal: '发送一条 Lark 消息',
    status: TaskStatus.RUNNING,
    messages: [],
    trace: [],
    agentStates: [],
    approvals: [],
    createdAt: now,
    updatedAt: now
  } as unknown as TaskRecord;
}

describe('main-graph-pipeline-runtime skill execution state', () => {
  it('builds current skill execution for the matching runtime stage', () => {
    const task = createTask();
    task.capabilityAttachments = [
      {
        id: 'user-skill:lark-notify',
        displayName: 'Lark notify skill',
        sourceId: 'user-skill:lark-notify',
        kind: 'skill',
        owner: {
          ownerType: 'user-attached',
          ownerId: 'session:test',
          capabilityType: 'skill',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        enabled: true,
        metadata: {
          steps: [
            {
              title: 'Collect release context',
              instruction: 'Read the release context before sending.',
              toolNames: ['web.search']
            },
            {
              title: 'Send Lark notification',
              instruction: 'Send the final release note to Lark.',
              toolNames: ['lark.send_message']
            }
          ]
        },
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z'
      }
    ] as any;

    const execution = buildCurrentSkillExecution(task, 'execute', '2026-03-29T08:00:00.000Z');

    expect(execution).toEqual(
      expect.objectContaining({
        skillId: 'user-skill:lark-notify',
        displayName: 'Lark notify skill',
        phase: 'execute',
        stepIndex: 2,
        totalSteps: 2,
        title: 'Send Lark notification',
        instruction: 'Send the final release note to Lark.',
        toolNames: ['lark.send_message'],
        updatedAt: '2026-03-29T08:00:00.000Z'
      })
    );
  });

  it('prefers the next executable skill subtask from the compiled plan', () => {
    const task = createTask();
    task.capabilityAttachments = [
      {
        id: 'user-skill:lark-notify',
        displayName: 'Lark notify skill',
        sourceId: 'user-skill:lark-notify',
        kind: 'skill',
        owner: {
          ownerType: 'user-attached',
          ownerId: 'session:test',
          capabilityType: 'skill',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        enabled: true,
        metadata: {
          steps: [
            {
              title: 'Draft first message',
              instruction: 'Prepare the first execution draft.',
              toolNames: ['lark.send_message']
            },
            {
              title: 'Send final message',
              instruction: 'Send the final execution draft.',
              toolNames: ['lark.send_message']
            }
          ]
        },
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z'
      }
    ] as any;
    task.plan = {
      id: 'plan-1',
      goal: task.goal,
      summary: 'Plan',
      steps: [],
      subTasks: [
        {
          id: 'skill_step:user-skill:lark-notify:execute:1',
          title: 'Lark notify skill · Draft first message',
          description: 'Prepare the first execution draft.',
          assignedTo: 'executor',
          status: 'completed'
        },
        {
          id: 'skill_step:user-skill:lark-notify:execute:2',
          title: 'Lark notify skill · Send final message',
          description: 'Send the final execution draft.',
          assignedTo: 'executor',
          status: 'running'
        }
      ],
      createdAt: '2026-03-29T00:00:00.000Z'
    } as any;

    const execution = buildCurrentSkillExecution(task, 'execute', '2026-03-29T08:00:00.000Z');

    expect(execution).toEqual(
      expect.objectContaining({
        phase: 'execute',
        stepIndex: 2,
        title: 'Send final message'
      })
    );
  });

  it('resolves research and execution objectives by semantic dispatch role instead of array position', () => {
    const dispatches = [
      {
        taskId: 'task-1',
        subTaskId: 'sub-fallback',
        from: AgentRole.MANAGER,
        to: AgentRole.MANAGER,
        kind: 'fallback',
        objective: '通才兜底'
      },
      {
        taskId: 'task-1',
        subTaskId: 'sub-strategy',
        from: AgentRole.MANAGER,
        to: AgentRole.RESEARCH,
        kind: 'strategy',
        objective: '先整理策略约束'
      },
      {
        taskId: 'task-1',
        subTaskId: 'sub-exec',
        from: AgentRole.MANAGER,
        to: AgentRole.EXECUTOR,
        kind: 'ministry',
        objective: '执行主方案'
      }
    ];

    expect(resolveResearchDispatchObjective(dispatches as any)).toBe('先整理策略约束');
    expect(resolveExecutionDispatchObjective(dispatches as any)).toBe('执行主方案');
  });

  it('blocks execute stage when mode gate keeps the task in plan mode', async () => {
    const now = '2026-03-31T00:00:00.000Z';
    const task = createTask();
    task.executionPlan = { mode: 'plan' } as any;
    task.executionMode = 'plan' as any;
    task.currentMinistry = 'gongbu-code' as any;

    const callbacks = {
      ensureTaskNotCancelled: () => undefined,
      syncTaskRuntime: () => undefined,
      markSubgraph: () => undefined,
      markWorkerUsage: () => undefined,
      attachTool: () => undefined,
      recordToolUsage: () => undefined,
      addTrace: (currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
        currentTask.trace.push({ node, at: now, summary, data } as never);
      },
      addProgressDelta: () => undefined,
      setSubTaskStatus: () => undefined,
      addMessage: () => undefined,
      upsertAgentState: () => undefined,
      persistAndEmitTask: async () => undefined,
      updateBudgetState: (_task: TaskRecord, overrides: any) => ({ ...(task.budgetState ?? {}), ...overrides }),
      transitionQueueState: () => undefined,
      registerPendingExecution: () => undefined,
      resolveResearchMinistry: () => 'hubu-search' as const,
      resolveExecutionMinistry: () => 'gongbu-code' as const,
      getMinistryLabel: () => '工部',
      describeActionIntent: () => '执行',
      createAgentContext: () => ({}),
      resolveRuntimeSkillIntervention: async () => undefined,
      resolveSkillInstallInterruptResume: async () => undefined
    };

    const gongbu = { execute: async () => ({ summary: 'should not run' }) };
    const bingbu = { execute: async () => ({ summary: 'should not run' }) };
    const libuDocs = { execute: async () => ({ summary: 'should not run' }) };

    const next = await runExecuteStage(
      task,
      task.goal,
      {
        retryCount: 0,
        maxRetries: 2,
        dispatches: [
          {
            taskId: task.id,
            subTaskId: 'sub-1',
            from: AgentRole.MANAGER,
            to: AgentRole.EXECUTOR,
            kind: 'ministry',
            objective: '执行主方案'
          }
        ]
      } as any,
      gongbu as any,
      bingbu as any,
      libuDocs as any,
      new Map(),
      true,
      callbacks as any
    );

    expect(next.executionSummary).toContain('计划模式');
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'mode_gate' })]));
  });
});
