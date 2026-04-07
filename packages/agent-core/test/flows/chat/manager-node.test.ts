import { describe, expect, it, vi } from 'vitest';

import type { ReviewRecord } from '@agent/shared';

import { ManagerAgent } from '../../../src/flows/chat/nodes/manager-node';
import type { AgentRuntimeContext } from '../../../src/runtime/agent-runtime-context';

function createRuntimeContext(overrides?: Partial<AgentRuntimeContext>): AgentRuntimeContext {
  return {
    taskId: 'task-manager-1',
    goal: '帮我整理一次代码审查与修复计划',
    flow: 'chat',
    taskContext: '用户要求先给计划，再根据审查结果收敛动作。',
    memoryRepository: {} as never,
    skillRegistry: {} as never,
    approvalService: {} as never,
    toolRegistry: {} as never,
    sandbox: {} as never,
    llm: {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => null),
      streamText: vi.fn(async () => null),
      generateObject: vi.fn(async () => null)
    } as never,
    thinking: {
      manager: true,
      research: false,
      executor: false,
      reviewer: false
    },
    ...overrides
  };
}

describe('ManagerAgent', () => {
  it('falls back to supervisor plan and dispatches ministries when llm planning is unavailable', async () => {
    const generateObject = vi.fn(async () => null);
    const agent = new ManagerAgent(
      createRuntimeContext({
        llm: {
          isConfigured: vi.fn(() => true),
          generateText: vi.fn(async () => null),
          streamText: vi.fn(async () => null),
          generateObject
        } as never
      })
    );

    const plan = await agent.plan();
    const dispatches = agent.dispatch(plan);

    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.summary).toContain('研究、执行、评审');
    expect(agent.getState().status).toBe('completed');
    expect(agent.getState().plan).toEqual(plan.steps);
    expect(dispatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-manager-1',
          from: 'manager',
          objective: expect.any(String)
        })
      ])
    );
    expect(generateObject).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('以下是当前任务上下文：\n\n用户要求先给计划，再根据审查结果收敛动作。')
        })
      ]),
      expect.anything(),
      expect.objectContaining({ role: 'manager' })
    );
  });

  it('replyDirectly falls back to generateText when streaming returns null', async () => {
    const streamText = vi.fn(async () => null);
    const generateText = vi.fn(async () => '最终请先从风险最高的模块开始修复。');
    const agent = new ManagerAgent(
      createRuntimeContext({
        llm: {
          isConfigured: vi.fn(() => true),
          generateText,
          streamText,
          generateObject: vi.fn(async () => null)
        } as never
      })
    );

    const reply = await agent.replyDirectly();

    expect(reply).toBe('最终请先从风险最高的模块开始修复。');
    expect(streamText).toHaveBeenCalled();
    expect(generateText).toHaveBeenCalled();
  });

  it('finalize builds evaluation state from review and shapes fallback summary', async () => {
    const review: ReviewRecord = {
      taskId: 'task-manager-1',
      decision: 'retry',
      notes: ['需要补充回归测试覆盖。'],
      createdAt: '2026-04-01T00:00:00.000Z'
    };
    const agent = new ManagerAgent(
      createRuntimeContext({
        goal: '请总结这轮修复结果',
        llm: {
          isConfigured: vi.fn(() => true),
          generateText: vi.fn(async () => '本轮已定位问题，但仍需补充回归测试。\n\n引用来源：\n1. 内部运行记录'),
          streamText: vi.fn(async () => null),
          generateObject: vi.fn(async () => null)
        } as never
      })
    );

    const result = await agent.finalize(
      review,
      '本轮已定位问题，但仍需补充回归测试。',
      '本轮参考 2 条来源',
      '1. [网页|official] React 官方文档（react.dev）'
    );

    expect(result).toContain('引用来源');
    expect(result).toContain('内部运行记录');
    expect(agent.getState().evaluation).toMatchObject({
      success: false,
      quality: 'medium',
      shouldRetry: true,
      shouldWriteMemory: true,
      shouldCreateRule: false,
      shouldExtractSkill: false
    });
  });

  it('does not extract skills for weekly report drafting tasks even when review is approved', async () => {
    const review: ReviewRecord = {
      taskId: 'task-manager-weekly-1',
      decision: 'approved',
      notes: ['周报整理完成。'],
      createdAt: '2026-04-07T00:00:00.000Z'
    };
    const agent = new ManagerAgent(
      createRuntimeContext({
        goal: '参考上面的生成我当前完成任务的周报',
        llm: {
          isConfigured: vi.fn(() => true),
          generateText: vi.fn(async () => '本周完成事项如下。'),
          streamText: vi.fn(async () => null),
          generateObject: vi.fn(async () => null)
        } as never
      })
    );

    await agent.finalize(review, '本周完成事项如下。', '本轮参考 0 条来源', '');

    expect(agent.getState().evaluation).toMatchObject({
      success: true,
      shouldExtractSkill: false
    });
  });
});
