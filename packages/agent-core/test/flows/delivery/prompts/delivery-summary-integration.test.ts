import { describe, expect, it, vi } from 'vitest';

import type { ReviewRecord } from '@agent/shared';

import { ManagerAgent } from '../../../../src/flows/chat/nodes/manager-node';
import { LibuRouterMinistry } from '../../../../src/flows/ministries/libu-router-ministry';
import type { AgentRuntimeContext } from '../../../../src/runtime/agent-runtime-context';

function createRuntimeContext(overrides?: Partial<AgentRuntimeContext>): AgentRuntimeContext {
  return {
    taskId: 'task-delivery-sanitize-1',
    goal: '请总结这轮执行结果',
    flow: 'chat',
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

function buildOperationalLeakSample() {
  return `
首辅已在本地技能库中命中 5 个可复用候选。
收到你的任务，首辅正在拆解目标并准备调度六部。
本轮已切换到 QA 测试流程。
首辅已完成规划，接下来会按 3 个步骤推进。
已分派给 research：收集与目标相关的上下文、文档与规范。
礼部开始审查并整理交付。
首辅视角：我先确认目标边界，再决定是直接回复还是进入多部协作流程。
原始记录：这是内部运行记录。
{
  "runId": "run_1774657114744"
}

这是最终给用户的答复。
  `.trim();
}

const approvedReview: ReviewRecord = {
  taskId: 'task-delivery-sanitize-1',
  decision: 'approved',
  notes: ['通过'],
  createdAt: '2026-03-28T00:00:00.000Z'
};

describe('delivery summary sanitization at node level', () => {
  it('ManagerAgent.replyDirectly 会在写入 finalOutput 前净化运行态话术', async () => {
    const leakedOutput = buildOperationalLeakSample();
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => leakedOutput),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const agent = new ManagerAgent(context);
    const result = await agent.replyDirectly();

    expect(result).toBe('这是最终给用户的答复。');
    expect(agent.getState().finalOutput).toBe('这是最终给用户的答复。');
  });

  it('ManagerAgent.finalize 会在写入 finalOutput 前净化运行态话术', async () => {
    const leakedOutput = buildOperationalLeakSample();
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => leakedOutput),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const agent = new ManagerAgent(context);
    const result = await agent.finalize(approvedReview, '执行摘要', '本轮参考 3 条来源');

    expect(result).toBe('这是最终给用户的答复。');
    expect(agent.getState().finalOutput).toBe('这是最终给用户的答复。');
  });

  it('ManagerAgent.finalize 在存在引用来源时只追加真实引用段落', async () => {
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => '这是最终给用户的答复。'),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const agent = new ManagerAgent(context);
    const result = await agent.finalize(
      approvedReview,
      '执行摘要',
      '本轮参考 3 条来源',
      '1. [网页|official] Playwright 官方文档（playwright.dev）'
    );

    expect(result).toContain('引用来源');
    expect(result).toContain('Playwright 官方文档');
    expect(result).not.toContain('这个判断优先基于你当前描述里的业务目标');
  });

  it('LibuRouterMinistry.replyDirectly 会在写入 finalOutput 前净化运行态话术', async () => {
    const leakedOutput = buildOperationalLeakSample();
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => leakedOutput),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const ministry = new LibuRouterMinistry(context);
    const result = await ministry.replyDirectly();

    expect(result).toBe('这是最终给用户的答复。');
    expect(ministry.getState().finalOutput).toBe('这是最终给用户的答复。');
  });

  it('LibuRouterMinistry.finalize 会在写入 finalOutput 前净化运行态话术', async () => {
    const leakedOutput = buildOperationalLeakSample();
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => leakedOutput),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const ministry = new LibuRouterMinistry(context);
    const result = await ministry.finalize(approvedReview, '执行摘要', '本轮参考 3 条来源');

    expect(result).toBe('这是最终给用户的答复。');
    expect(ministry.getState().finalOutput).toBe('这是最终给用户的答复。');
  });

  it('LibuRouterMinistry.finalize 在存在引用来源时只追加真实引用段落', async () => {
    const context = createRuntimeContext({
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText: vi.fn(async () => '这是最终给用户的答复。'),
        generateObject: vi.fn(async () => null)
      } as never
    });

    const ministry = new LibuRouterMinistry(context);
    const result = await ministry.finalize(
      approvedReview,
      '执行摘要',
      '本轮参考 3 条来源',
      '1. [网页|official] Playwright 官方文档（playwright.dev）'
    );

    expect(result).toContain('引用来源');
    expect(result).toContain('Playwright 官方文档');
    expect(result).not.toContain('这个判断优先基于你当前描述里的业务目标');
  });

  it('LibuRouterMinistry.replyDirectly 会把 taskContext 一起传给模型', async () => {
    const streamText = vi.fn(async () => '基于上下文生成的答复。');
    const context = createRuntimeContext({
      taskContext: '用户上一轮在讨论 VIP 承接与投放 ROI。',
      llm: {
        isConfigured: vi.fn(() => true),
        generateText: vi.fn(async () => null),
        streamText,
        generateObject: vi.fn(async () => null)
      } as never
    });

    const ministry = new LibuRouterMinistry(context);
    await ministry.replyDirectly();

    expect(streamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('以下是当前任务上下文：\n\n用户上一轮在讨论 VIP 承接与投放 ROI。')
        })
      ]),
      expect.any(Object),
      expect.any(Function)
    );
  });
});
