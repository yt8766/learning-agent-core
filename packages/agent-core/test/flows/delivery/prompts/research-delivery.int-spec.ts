import { describe, expect, it, vi } from 'vitest';

import type { ReviewRecord } from '@agent/shared';

import { ManagerAgent } from '../../../../src/flows/chat/nodes/manager-node';
import { LibuRouterMinistry } from '../../../../src/flows/ministries/libu-router-ministry';
import type { AgentRuntimeContext } from '../../../../src/runtime/agent-runtime-context';

function createRuntimeContext(
  streamText: ReturnType<typeof vi.fn>,
  overrides?: Partial<AgentRuntimeContext>
): AgentRuntimeContext {
  return {
    taskId: 'task-research-delivery-1',
    goal: '总结这轮研究后还有什么优化方向',
    taskContext: '上一轮已经收集了 VIP、支付 ROI 和流式体验相关研究。',
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
      research: true,
      executor: false,
      reviewer: false
    },
    ...overrides
  };
}

const approvedReview: ReviewRecord = {
  taskId: 'task-research-delivery-1',
  decision: 'approved',
  notes: ['研究和交付都通过'],
  createdAt: '2026-03-28T00:00:00.000Z'
};

const freshnessSourceSummary = '本轮参考 2 条最近 30 天内的官方来源。';
const citationSourceSummary = [
  '1. [网页|official] OpenAI 官方发布页（openai.com）',
  '2. [网页|official] Playwright 官方文档（playwright.dev）'
].join('\n');

describe('Research -> Delivery integration', () => {
  it('passes research source summaries into both delivery nodes and appends only real citations', async () => {
    const managerStreamText = vi.fn(async () => '先回答你的追问，再补关键依据。');
    const ministryStreamText = vi.fn(async () => '先回答你的追问，再补关键依据。');

    const manager = new ManagerAgent(createRuntimeContext(managerStreamText));
    const ministry = new LibuRouterMinistry(createRuntimeContext(ministryStreamText));

    const managerReply = await manager.finalize(
      approvedReview,
      '研究显示默认智能搜索、连续上下文和流式首字速度仍有优化空间。',
      freshnessSourceSummary,
      citationSourceSummary
    );
    const ministryReply = await ministry.finalize(
      approvedReview,
      '研究显示默认智能搜索、连续上下文和流式首字速度仍有优化空间。',
      freshnessSourceSummary,
      citationSourceSummary
    );

    expect(managerStreamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(`来源透明度：${freshnessSourceSummary}`)
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(`可引用来源：\n${citationSourceSummary}`)
        })
      ]),
      expect.any(Object),
      expect.any(Function)
    );
    expect(ministryStreamText).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(`来源透明度：${freshnessSourceSummary}`)
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(`可引用来源：\n${citationSourceSummary}`)
        })
      ]),
      expect.any(Object),
      expect.any(Function)
    );

    expect(managerReply).toContain('先回答你的追问，再补关键依据。');
    expect(managerReply).toContain('引用来源');
    expect(managerReply).toContain('OpenAI 官方发布页');
    expect(managerReply).toContain('Playwright 官方文档');
    expect(ministryReply).toBe(managerReply);
  });
});
