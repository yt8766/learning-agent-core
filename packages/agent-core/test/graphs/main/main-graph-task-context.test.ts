import { describe, expect, it, vi } from 'vitest';
import { TaskStatus, type TaskRecord } from '@agent/shared';

import { MainGraphTaskContextRuntime } from '../../../src/graphs/main/task/main-graph-task-context';

// task.activeInterrupt remains the persisted 司礼监 / InterruptController projection in runtime tests.
function createTask(): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: 'task_ctx_test',
    goal: '验证 llm fallback trace 写入',
    status: TaskStatus.RUNNING,
    messages: [],
    trace: [],
    plan: undefined,
    agentStates: [],
    approvals: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    specialistLead: {
      id: 'product-strategy',
      displayName: '产品策略专家',
      domain: 'product-strategy',
      reason: '需要产品策略判断'
    }
  } as unknown as TaskRecord;
}

describe('MainGraphTaskContextRuntime onModelEvent', () => {
  it('会把 fallback 事件写入 task trace', () => {
    const task = createTask();
    const tasks = new Map<string, TaskRecord>([[task.id, task]]);
    const addTrace = vi.fn((currentTask: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => {
      currentTask.trace.push({
        node,
        at: new Date().toISOString(),
        summary,
        data,
        specialistId: typeof data?.specialistId === 'string' ? data.specialistId : undefined,
        modelUsed: typeof data?.modelUsed === 'string' ? data.modelUsed : undefined,
        isFallback: typeof data?.isFallback === 'boolean' ? data.isFallback : undefined,
        fallbackReason: typeof data?.fallbackReason === 'string' ? data.fallbackReason : undefined
      } as never);
    });

    const runtime = new MainGraphTaskContextRuntime(
      {
        memoryRepository: {} as never,
        ruleRepository: {} as never,
        runtimeStateRepository: {} as never,
        skillRegistry: {} as never,
        approvalService: {} as never,
        sandboxExecutor: {} as never
      },
      {
        contextStrategy: 'recent',
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      } as never,
      {
        isConfigured: vi.fn(() => true)
      } as never,
      {} as never,
      {
        get: vi.fn()
      } as never,
      tasks,
      addTrace,
      vi.fn(),
      vi.fn(),
      vi.fn()
    );

    const context = runtime.createAgentContext(task.id, task.goal, 'chat');
    context.onModelEvent?.({
      role: 'manager',
      modelUsed: 'gpt-4o-mini',
      isFallback: true,
      fallbackReason: '429 Too Many Requests',
      status: 'fallback'
    });

    expect(addTrace).toHaveBeenCalledWith(
      task,
      'llm_fallback',
      'LLM 已切换到备用模型 gpt-4o-mini。',
      expect.objectContaining({
        specialistId: 'product-strategy',
        modelUsed: 'gpt-4o-mini',
        isFallback: true,
        fallbackReason: '429 Too Many Requests'
      })
    );
    expect(task.trace[0]).toEqual(
      expect.objectContaining({
        node: 'llm_fallback',
        modelUsed: 'gpt-4o-mini',
        isFallback: true
      })
    );
  });

  it('createAgentContext 会暴露当前 task 编译出的 skill contract', () => {
    const task = createTask();
    task.requestedHints = {
      requestedSkill: 'Lark notify skill'
    } as any;
    task.capabilityAttachments = [
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
              title: 'Send message',
              instruction: 'Send the approved Lark message.',
              toolNames: ['lark.send_message']
            }
          ],
          requiredConnectors: ['lark-mcp-template'],
          requiredTools: ['lark.send_message']
        },
        createdAt: new Date().toISOString()
      }
    ] as any;

    const tasks = new Map<string, TaskRecord>([[task.id, task]]);
    const runtime = new MainGraphTaskContextRuntime(
      {
        memoryRepository: {} as never,
        ruleRepository: {} as never,
        runtimeStateRepository: {} as never,
        skillRegistry: {} as never,
        approvalService: {} as never,
        sandboxExecutor: {} as never
      },
      {
        contextStrategy: 'recent',
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      } as never,
      {
        isConfigured: vi.fn(() => true)
      } as never,
      {} as never,
      {
        get: vi.fn()
      } as never,
      tasks,
      vi.fn(),
      vi.fn((_, overrides) => overrides as never),
      vi.fn(),
      vi.fn()
    );

    const context = runtime.createAgentContext(task.id, task.goal, 'chat');

    expect(context.compiledSkill).toEqual(
      expect.objectContaining({
        name: 'Lark notify skill',
        requiredConnectors: ['lark-mcp-template'],
        requiredTools: ['lark.send_message'],
        steps: expect.arrayContaining([
          expect.objectContaining({
            title: 'Send message'
          })
        ])
      })
    );
  });

  it('createAgentContext 会在计划模式未 finalized 时暴露 plan executionMode', () => {
    const task = createTask();
    task.planMode = 'implementation';
    const tasks = new Map<string, TaskRecord>([[task.id, task]]);
    const runtime = new MainGraphTaskContextRuntime(
      {
        memoryRepository: {} as never,
        ruleRepository: {} as never,
        runtimeStateRepository: {} as never,
        skillRegistry: {} as never,
        approvalService: {} as never,
        sandboxExecutor: {} as never
      },
      {
        contextStrategy: 'recent',
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      } as never,
      {
        isConfigured: vi.fn(() => true)
      } as never,
      {} as never,
      {
        get: vi.fn()
      } as never,
      tasks,
      vi.fn(),
      vi.fn((_, overrides) => overrides as never),
      vi.fn(),
      vi.fn()
    );

    const context = runtime.createAgentContext(task.id, task.goal, 'chat');

    expect(context.executionMode).toBe('plan');
  });

  it('onUsage 在接近预算软阈值时会挂起 supplemental-input interrupt', async () => {
    const task = createTask();
    task.budgetState = {
      stepBudget: 8,
      stepsConsumed: 0,
      retryBudget: 2,
      retriesConsumed: 0,
      sourceBudget: 8,
      sourcesConsumed: 0,
      tokenBudget: 100,
      tokenConsumed: 79,
      costBudgetUsd: 1,
      costConsumedUsd: 0.79,
      costConsumedCny: 0,
      softBudgetThreshold: 0.8,
      hardBudgetThreshold: 1,
      budgetInterruptState: { status: 'idle' },
      fallbackModelId: 'fallback-model',
      overBudget: false
    } as any;
    const tasks = new Map<string, TaskRecord>([[task.id, task]]);
    const runtime = new MainGraphTaskContextRuntime(
      {
        memoryRepository: {} as never,
        ruleRepository: {} as never,
        runtimeStateRepository: {} as never,
        skillRegistry: {} as never,
        approvalService: {} as never,
        sandboxExecutor: {} as never
      },
      {
        contextStrategy: 'recent',
        zhipuThinking: {
          manager: false,
          research: false,
          executor: false,
          reviewer: false
        }
      } as never,
      {
        isConfigured: vi.fn(() => true)
      } as never,
      {} as never,
      {
        get: vi.fn()
      } as never,
      tasks,
      vi.fn(),
      vi.fn((currentTask, overrides) => {
        const next = { ...(currentTask.budgetState ?? {}), ...overrides } as any;
        const tokenRatio = (next.tokenConsumed ?? 0) / (next.tokenBudget ?? 1);
        if (tokenRatio >= (next.softBudgetThreshold ?? 0.8)) {
          next.budgetInterruptState = {
            status: 'soft-threshold-triggered',
            interactionKind: 'supplemental-input',
            reason: '当前任务已接近预算阈值，建议缩小范围或确认是否继续。'
          };
        }
        return next;
      }),
      vi.fn(),
      vi.fn(async () => undefined)
    );

    const context = runtime.createAgentContext(task.id, task.goal, 'chat');
    context.onUsage?.({
      role: 'manager',
      usage: {
        promptTokens: 1,
        completionTokens: 1,
        totalTokens: 2,
        model: 'gpt-test'
      }
    });

    await Promise.resolve();
    expect(task.activeInterrupt).toEqual(
      expect.objectContaining({
        interactionKind: 'supplemental-input',
        timeoutPolicy: 'cancel-task'
      })
    );
  });
});
