import { describe, expect, it, vi } from 'vitest';

import { ManagerAgent } from '../../../src/flows/chat/nodes/manager-node';
import { LibuRouterMinistry } from '../../../src/flows/ministries/libu-router-ministry';
import type { AgentRuntimeContext } from '../../../src/runtime/agent-runtime-context';

function buildOperationalLeakSample() {
  return `
首辅已在本地技能库中命中 5 个可复用候选。
收到你的任务，首辅正在拆解目标并准备调度六部。
本轮已切换到 QA 测试流程。
首辅已完成规划，接下来会按 3 个步骤推进。
礼部开始审查并整理交付。

真正给用户的连续答复。
  `.trim();
}

function createRuntimeContext(
  streamText: ReturnType<typeof vi.fn>,
  overrides?: Partial<AgentRuntimeContext>
): AgentRuntimeContext {
  return {
    taskId: 'task-supervisor-ministry-1',
    goal: '上面的还有什么优化的地方',
    taskContext: [
      '首辅已在本地技能库中命中 5 个可复用候选。',
      '户部战报：当前最值得复用的是上一轮关于 VIP 承接与投放 ROI 的诊断。',
      '上一轮已经分析了 VIP 承接、支付 ROI 和引用来源问题。'
    ].join('\n'),
    flow: 'chat',
    memoryRepository: {} as never,
    skillRegistry: {} as never,
    approvalService: {} as never,
    toolRegistry: {} as never,
    sandbox: {} as never,
    llm: {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => null),
      streamText,
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

describe('Supervisor -> Ministry context integration', () => {
  it('keeps direct-reply context and final answer shaping aligned between ManagerAgent and LibuRouterMinistry', async () => {
    const managerStreamText = vi.fn(async () => buildOperationalLeakSample());
    const ministryStreamText = vi.fn(async () => buildOperationalLeakSample());

    const manager = new ManagerAgent(createRuntimeContext(managerStreamText));
    const ministry = new LibuRouterMinistry(createRuntimeContext(ministryStreamText));

    const managerReply = await manager.replyDirectly();
    const ministryReply = await ministry.replyDirectly();

    expect(managerReply).toBe('真正给用户的连续答复。');
    expect(ministryReply).toBe('真正给用户的连续答复。');
    expect(manager.getState().finalOutput).toBe('真正给用户的连续答复。');
    expect(ministry.getState().finalOutput).toBe('真正给用户的连续答复。');

    expect(managerStreamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(
            '以下是当前任务上下文：\n\n上一轮已经分析了 VIP 承接、支付 ROI 和引用来源问题。'
          )
        })
      ]),
      expect.any(Object),
      expect.any(Function)
    );
    expect(ministryStreamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(
            '以下是当前任务上下文：\n\n上一轮已经分析了 VIP 承接、支付 ROI 和引用来源问题。'
          )
        })
      ]),
      expect.any(Object),
      expect.any(Function)
    );
    const managerPromptMessages = ((managerStreamText as any).mock.calls[0]?.[0] ?? []) as Array<{ content: string }>;
    const ministryPromptMessages = ((ministryStreamText as any).mock.calls[0]?.[0] ?? []) as Array<{
      content: string;
    }>;

    expect(managerPromptMessages?.[1]?.content ?? '').not.toContain('户部战报');
    expect(ministryPromptMessages?.[1]?.content ?? '').not.toContain('首辅已在本地技能库中命中');
  });
});
