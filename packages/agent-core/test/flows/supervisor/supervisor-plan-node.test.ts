import { describe, expect, it, vi } from 'vitest';

import { executeSupervisorPlan } from '../../../src/flows/supervisor/nodes/supervisor-plan-node';

describe('executeSupervisorPlan', () => {
  it('passes sanitized context and usage callbacks into llm planning', async () => {
    const onUsage = vi.fn();
    const generateObject = vi.fn(async (_messages, _schema, options) => {
      options.onUsage?.({
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20
      });
      return {
        summary: '先研究，再执行，再审查',
        subTasks: [
          { title: '研究', description: '收集上下文', assignedTo: 'research' },
          { title: '执行', description: '完成实现', assignedTo: 'executor' },
          { title: '审查', description: '检查结果', assignedTo: 'reviewer' }
        ]
      };
    });

    const result = await executeSupervisorPlan({
      taskId: 'task-1',
      goal: '重构聊天工作区',
      taskContext: '收到你的任务，首辅正在拆解目标并准备调度六部。\n\n保留的真实上下文',
      currentWorker: { defaultModel: 'gpt-5.4' },
      budgetState: { costBudgetUsd: 2 },
      thinking: { manager: true },
      onUsage,
      llm: {
        generateObject
      }
    } as any);

    expect(generateObject).toHaveBeenCalledWith(
      [
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('保留的真实上下文')
        })
      ],
      expect.anything(),
      expect.objectContaining({
        role: 'manager',
        taskId: 'task-1',
        modelId: 'gpt-5.4',
        thinking: true,
        temperature: 0.1
      })
    );
    expect(generateObject.mock.calls[0]?.[0]?.[1]?.content).not.toContain('首辅正在拆解目标');
    expect(onUsage).toHaveBeenCalledWith({
      usage: {
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20
      },
      role: 'manager'
    });
    expect(result.subTasks).toHaveLength(3);
  });

  it('falls back to the default supervisor plan when llm returns null and no sanitized context is available', async () => {
    const generateObject = vi.fn(async () => null);

    const result = await executeSupervisorPlan({
      taskId: 'task-2',
      goal: '补齐 coverage',
      taskContext: undefined,
      currentWorker: undefined,
      budgetState: undefined,
      thinking: { manager: false },
      llm: {
        generateObject
      }
    } as any);

    expect(generateObject.mock.calls[0]?.[0]?.[1]?.content).not.toContain('以下是当前任务上下文');
    expect(result.subTasks).toHaveLength(3);
    expect(result.goal).toBe('补齐 coverage');
  });
});
