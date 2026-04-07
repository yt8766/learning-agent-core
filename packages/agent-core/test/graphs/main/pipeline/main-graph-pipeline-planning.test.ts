import { describe, expect, it, vi } from 'vitest';

import { AgentRole, TaskStatus, type TaskRecord } from '@agent/shared';

import { runDispatchStage, runManagerPlanStage } from '../../../../src/flows/supervisor/pipeline-stage-nodes';

describe('main-graph-pipeline-planning skill contract compilation', () => {
  it('compiles attached skill steps into the manager plan and trace', async () => {
    const now = new Date().toISOString();
    const task = {
      id: 'task-1',
      goal: '继续用 Lark 通知结果',
      status: TaskStatus.QUEUED,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      specialistFindings: [],
      capabilityAttachments: [
        {
          id: 'user-skill:lark-skill',
          displayName: 'Lark notify skill',
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
                title: 'Prepare target',
                instruction: 'Confirm the chat target and message payload.',
                toolNames: ['lark.list_chats']
              },
              {
                title: 'Send message',
                instruction: 'Send the final message after approval.',
                toolNames: ['lark.send_message']
              }
            ],
            requiredConnectors: ['lark-mcp-template'],
            approvalSensitiveTools: ['lark.send_message']
          },
          createdAt: now,
          updatedAt: now
        }
      ],
      requestedHints: {
        requestedSkill: 'Lark notify skill',
        requestedConnectorTemplate: 'lark-mcp-template'
      },
      resolvedWorkflow: {
        id: 'workflow',
        displayName: 'Workflow',
        requiredMinistries: ['hubu-search', 'bingbu-ops', 'xingbu-review'],
        outputContract: {
          type: 'summary'
        },
        approvalPolicy: 'manual'
      },
      createdAt: now,
      updatedAt: now
    } as any as TaskRecord;

    const callbacks = {
      ensureTaskNotCancelled: vi.fn(),
      syncTaskRuntime: vi.fn(),
      addTrace: vi.fn((currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
        currentTask.trace.push({ node, at: now, summary, data } as never);
      }),
      addProgressDelta: vi.fn(),
      attachTool: vi.fn(),
      recordToolUsage: vi.fn(),
      persistAndEmitTask: vi.fn(async () => undefined),
      resolveWorkflowRoutes: vi.fn(() => []),
      markWorkerUsage: vi.fn(),
      recordDispatches: vi.fn(),
      upsertAgentState: vi.fn()
    };

    const libu = {
      plan: vi.fn(),
      getState: vi.fn(() => ({ role: AgentRole.MANAGER, status: 'running' })),
      dispatch: vi.fn(() => [])
    };

    await runManagerPlanStage(
      task,
      { goal: task.goal, sessionId: 'session:test' },
      { retryCount: 0, maxRetries: 2, dispatches: [] } as any,
      libu as any,
      callbacks
    );

    expect(task.plan?.summary).toContain('已挂载技能：Lark notify skill');
    expect(task.plan?.steps).toEqual(
      expect.arrayContaining([expect.stringContaining('Prepare target'), expect.stringContaining('Send message')])
    );
    expect(task.plan?.subTasks.find(item => item.assignedTo === AgentRole.EXECUTOR)?.description).toContain(
      'Send message'
    );
    expect(task.plan?.subTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill_step:user-skill:lark-skill:executor:1',
          title: 'Lark notify skill · Prepare target',
          assignedTo: AgentRole.EXECUTOR,
          status: 'pending'
        }),
        expect.objectContaining({
          id: 'skill_step:user-skill:lark-skill:executor:2',
          title: 'Lark notify skill · Send message',
          assignedTo: AgentRole.EXECUTOR,
          status: 'pending'
        })
      ])
    );
    expect(task.complexTaskPlan).toEqual(
      expect.objectContaining({
        node: 'complex_task_plan',
        status: 'completed',
        summary: expect.stringContaining('已挂载技能：Lark notify skill'),
        subGoals: expect.arrayContaining(['Lark notify skill · Prepare target', 'Lark notify skill · Send message']),
        dependencies: expect.arrayContaining([
          expect.objectContaining({
            from: expect.any(String),
            to: expect.any(String)
          })
        ]),
        recoveryPoints: expect.arrayContaining([
          expect.stringContaining('Lark notify skill · Prepare target:pending'),
          expect.stringContaining('Lark notify skill · Send message:pending')
        ])
      })
    );
    expect(task.trace).toEqual(expect.arrayContaining([expect.objectContaining({ node: 'skill_contract_compiled' })]));
  });

  it('persists dispatches in strategy -> ministry -> fallback order and records audience slices', async () => {
    const now = new Date().toISOString();
    const task = {
      id: 'task-dispatch-order',
      goal: '先确认约束再执行方案',
      status: TaskStatus.RUNNING,
      trace: [],
      approvals: [],
      agentStates: [],
      messages: [],
      createdAt: now,
      updatedAt: now
    } as any as TaskRecord;

    const callbacks = {
      ensureTaskNotCancelled: vi.fn(),
      syncTaskRuntime: vi.fn(),
      addTrace: vi.fn((currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
        currentTask.trace.push({ node, at: now, summary, data } as never);
      }),
      addProgressDelta: vi.fn(),
      persistAndEmitTask: vi.fn(async () => undefined),
      resolveWorkflowRoutes: vi.fn(() => []),
      markWorkerUsage: vi.fn(),
      recordDispatches: vi.fn((currentTask: TaskRecord, dispatches: any) => {
        currentTask.dispatches = dispatches;
      }),
      upsertAgentState: vi.fn(),
      attachTool: vi.fn(),
      recordToolUsage: vi.fn()
    };

    const next = await runDispatchStage(
      task,
      {
        retryCount: 0,
        maxRetries: 2,
        dispatches: [
          {
            taskId: task.id,
            subTaskId: 'sub-3',
            from: AgentRole.MANAGER,
            to: AgentRole.MANAGER,
            kind: 'fallback',
            objective: '通才兜底'
          },
          {
            taskId: task.id,
            subTaskId: 'sub-2',
            from: AgentRole.MANAGER,
            to: AgentRole.EXECUTOR,
            kind: 'ministry',
            objective: '执行主方案'
          },
          {
            taskId: task.id,
            subTaskId: 'sub-1',
            from: AgentRole.MANAGER,
            to: AgentRole.RESEARCH,
            kind: 'strategy',
            objective: '整理策略约束'
          }
        ]
      } as any,
      callbacks
    );

    expect(next.dispatches?.map(item => item.kind)).toEqual(['strategy', 'ministry', 'fallback']);
    expect(task.contextFilterState?.dispatchOrder).toEqual(['strategy', 'ministry', 'fallback']);
    expect(task.contextFilterState?.audienceSlices).toEqual(
      expect.objectContaining({
        strategy: expect.objectContaining({ dispatchCount: 1 }),
        ministry: expect.objectContaining({ dispatchCount: 1 }),
        fallback: expect.objectContaining({ dispatchCount: 1 })
      })
    );
  });
});
