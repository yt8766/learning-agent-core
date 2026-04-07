import { describe, expect, it, vi } from 'vitest';
import { AgentRole, TaskStatus, type ExecutionTrace, type TaskRecord } from '@agent/shared';
import { createDefaultToolRegistry } from '@agent/tools';

import { MainGraphTaskRuntime } from '../../../src/graphs/main/task/main-graph-task-runtime';

function createRuntime() {
  return new MainGraphTaskRuntime(
    {
      toolRegistry: createDefaultToolRegistry()
    },
    {
      profile: 'personal',
      policy: {
        budget: {
          stepBudget: 8,
          retryBudget: 2,
          sourceBudget: 8,
          maxCostPerTaskUsd: 0,
          fallbackModelId: 'fallback-model'
        }
      },
      zhipuThinking: {
        manager: false,
        research: false,
        executor: false,
        reviewer: false
      }
    } as never,
    {} as never,
    {} as never,
    new Set<string>(),
    vi.fn()
  );
}

function createTask(): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task_trace_test',
    goal: '验证 trace/span 写入',
    status: TaskStatus.RUNNING,
    messages: [],
    trace: [],
    plan: {
      id: 'plan_trace_test',
      goal: '验证 trace/span 写入',
      summary: 'trace test',
      steps: [],
      subTasks: [{ id: 'sub_1', title: 'sub', description: 'sub', assignedTo: AgentRole.MANAGER, status: 'pending' }],
      createdAt: now
    },
    agentStates: [],
    approvals: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    queueState: {
      mode: 'foreground',
      backgroundRun: false,
      status: 'running',
      enqueuedAt: now,
      lastTransitionAt: now,
      attempt: 1
    }
  } as unknown as TaskRecord;
}

describe('MainGraphTaskRuntime.addTrace', () => {
  it('会自动补齐 traceId/spanId 并关联 parent span', () => {
    const runtime = createRuntime();
    const task = createTask();
    const trace: ExecutionTrace[] = [];

    runtime.addTrace(
      trace,
      'specialist_routed',
      '已选择主导专家。',
      { specialistId: 'product-strategy', role: 'lead' },
      task
    );
    runtime.addTrace(
      trace,
      'research',
      '户部已提交研究结果。',
      { role: 'support', specialistId: 'growth-marketing' },
      task
    );

    expect(task.traceId).toBeTruthy();
    expect(trace[0]?.spanId).toBeTruthy();
    expect(trace[0]).toEqual(
      expect.objectContaining({
        traceId: task.traceId,
        spanId: expect.any(String),
        specialistId: 'product-strategy',
        role: 'lead'
      })
    );
    expect(trace[1]).toEqual(
      expect.objectContaining({
        traceId: task.traceId,
        spanId: expect.any(String),
        specialistId: 'growth-marketing',
        role: 'support',
        parentSpanId: trace[0]?.spanId
      })
    );
  });
});

describe('MainGraphTaskRuntime tool telemetry', () => {
  it('writes tool attachments and usage summary onto the task', () => {
    const runtime = createRuntime();
    const task = createTask();

    runtime.attachTool(task, {
      toolName: 'schedule_cancel',
      attachedBy: 'runtime',
      preferred: true,
      reason: '需要治理当前调度任务',
      ownerType: 'ministry-owned',
      ownerId: 'bingbu-ops'
    });

    runtime.recordToolUsage(task, {
      toolName: 'schedule_cancel',
      status: 'blocked',
      requestedBy: 'bingbu-ops',
      reason: '等待人工确认后再取消',
      blockedReason: 'requires approval',
      approvalRequired: true
    });

    expect(task.toolAttachments).toEqual([
      expect.objectContaining({
        toolName: 'schedule_cancel',
        family: 'runtime-governance',
        ownerType: 'ministry-owned',
        ownerId: 'bingbu-ops',
        attachedBy: 'runtime',
        preferred: true,
        reason: '需要治理当前调度任务'
      })
    ]);
    expect(task.toolUsageSummary).toEqual([
      expect.objectContaining({
        toolName: 'schedule_cancel',
        family: 'runtime-governance',
        capabilityType: 'governance-tool',
        status: 'blocked',
        route: 'governance',
        requestedBy: 'bingbu-ops',
        reason: '等待人工确认后再取消',
        blockedReason: 'requires approval',
        approvalRequired: true
      })
    ]);
  });
});

describe('MainGraphTaskRuntime dispatch recording', () => {
  it('persists canonical dispatch kinds onto the task', () => {
    const runtime = createRuntime();
    const task = createTask();

    runtime.recordDispatches(task, [
      {
        taskId: task.id,
        subTaskId: 'sub-strategy',
        from: AgentRole.MANAGER,
        to: AgentRole.RESEARCH,
        kind: 'strategy',
        objective: '先整理策略约束'
      },
      {
        taskId: task.id,
        subTaskId: 'sub-execute',
        from: AgentRole.MANAGER,
        to: AgentRole.EXECUTOR,
        kind: 'ministry',
        objective: '再执行具体方案'
      }
    ]);

    expect(task.dispatches).toEqual([
      expect.objectContaining({ kind: 'strategy', objective: '先整理策略约束' }),
      expect.objectContaining({ kind: 'ministry', objective: '再执行具体方案' })
    ]);
  });
});

describe('MainGraphTaskRuntime budget gate state', () => {
  it('projects open, throttled, soft_blocked and hard_blocked states', () => {
    const runtime = createRuntime();
    const task = createTask();

    runtime.updateBudgetState(task, {
      tokenBudget: 100,
      tokenConsumed: 10,
      costBudgetUsd: 10,
      costConsumedUsd: 1
    });
    expect(task.budgetGateState).toEqual(
      expect.objectContaining({
        status: 'open'
      })
    );

    task.queueState = {
      ...task.queueState!,
      status: 'queued'
    };
    runtime.updateBudgetState(task, {
      tokenBudget: 100,
      tokenConsumed: 10,
      costBudgetUsd: 10,
      costConsumedUsd: 1,
      budgetInterruptState: { status: 'idle' }
    });
    expect(task.budgetGateState).toEqual(
      expect.objectContaining({
        status: 'throttled',
        queueDepth: 1
      })
    );

    task.queueState = {
      ...task.queueState!,
      status: 'running'
    };
    runtime.updateBudgetState(task, {
      tokenBudget: 100,
      tokenConsumed: 85,
      costBudgetUsd: 10,
      costConsumedUsd: 8.5,
      budgetInterruptState: { status: 'idle' }
    });
    expect(task.budgetGateState).toEqual(
      expect.objectContaining({
        status: 'soft_blocked'
      })
    );

    const hardBudget = runtime.updateBudgetState(task, {
      tokenBudget: 100,
      tokenConsumed: 120,
      costBudgetUsd: 10,
      costConsumedUsd: 12,
      budgetInterruptState: { status: 'idle' }
    });
    expect(task.budgetGateState).toEqual(
      expect.objectContaining({
        status: 'hard_blocked'
      })
    );
    expect(hardBudget.budgetInterruptState).toEqual(
      expect.objectContaining({
        status: 'hard-threshold-triggered'
      })
    );
  });
});
