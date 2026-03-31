import { describe, expect, it, vi } from 'vitest';

import {
  buildDeliverySummaryUserPrompt,
  DELIVERY_SUMMARY_SYSTEM_PROMPT,
  sanitizeFinalUserReply,
  shapeFinalUserReply
} from '../../../../src/flows/delivery/prompts/delivery-summary-prompts';

describe('buildDeliverySummaryUserPrompt', () => {
  it('includes freshness provenance when provided', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T10:00:00.000Z'));

    const prompt = buildDeliverySummaryUserPrompt(
      '最近 AI 有没有新技术',
      '执行阶段已完成研究。',
      'approved',
      ['通过'],
      '本轮共参考 4 条来源；官方来源 3 条；来源类型：web_research_plan、research'
    );

    expect(prompt).toContain('信息基准日期：2026-03-26');
    expect(prompt).toContain('来源透明度：本轮共参考 4 条来源；官方来源 3 条；来源类型：web_research_plan、research');

    vi.useRealTimers();
  });

  it('includes diagnosis-specific delivery guidance for diagnosis tasks', () => {
    const prompt = buildDeliverySummaryUserPrompt(
      '请诊断任务 task-agent-error 的 agent 错误并给出恢复方案。',
      '已收集最近 trace、stack 与 connector 状态。',
      'blocked',
      ['需要先检查 connector 状态与审批恢复链路。']
    );

    expect(prompt).toContain('本题属于 agent 故障诊断任务。');
    expect(prompt).toContain('根因判断、恢复步骤、是否建议立即重试');
    expect(prompt).toContain('如果不建议立即重试，要明确说明阻塞点');
  });

  it('includes citation guidance and source list when citation sources are provided', () => {
    const prompt = buildDeliverySummaryUserPrompt(
      '这个产品规划怎么样',
      '已完成产品规划评审。',
      'approved',
      ['建议继续优化核心指标与验证节奏。'],
      undefined,
      '1. [网页|official] Playwright 官方文档（playwright.dev）\n2. [文档|official] 版本规划说明（docs.example.com）'
    );

    expect(prompt).toContain('引用要求：只能引用下列本轮真实来源');
    expect(prompt).toContain('可引用来源：');
    expect(prompt).toContain('请先识别用户最关心的结论，再组织最终答复。');
    expect(prompt).toContain('Playwright 官方文档');
    expect(prompt).toContain('版本规划说明');
  });

  it('includes product-expert guidance for product planning questions', () => {
    const prompt = buildDeliverySummaryUserPrompt(
      '这个产品规划怎么样，后续还有什么优化空间',
      '已完成产品规划评审。',
      'approved',
      ['建议收紧目标和验证顺序。']
    );

    expect(prompt).toContain('本题按产品/业务专家视角回答。');
    expect(prompt).toContain('为什么这么说');
    expect(prompt).toContain('后续怎么做');
  });

  it('keeps delivery system prompt focused on final-user answer shape', () => {
    expect(DELIVERY_SUMMARY_SYSTEM_PROMPT).toContain('你会收到目标、执行摘要、评审结论、评审说明');
    expect(DELIVERY_SUMMARY_SYSTEM_PROMPT).toContain('先给用户最重要的结论，再补关键依据和下一步');
    expect(DELIVERY_SUMMARY_SYSTEM_PROMPT).toContain('不回放内部思维链，不复读 trace');
  });
});

describe('sanitizeFinalUserReply', () => {
  it('会移除首辅流程类运行态话术，只保留真正用户可见内容', () => {
    const sanitized = sanitizeFinalUserReply(`
首辅已在本地技能库中命中 5 个可复用候选。
收到你的任务，首辅正在拆解目标并准备调度六部。
本轮已切换到 QA 测试流程。
首辅已完成规划，接下来会按 3 个步骤推进。
已分派给 research：收集与目标相关的上下文、文档与规范。
礼部开始审查并整理交付。

这里是最终应该给用户的结论。
    `);

    expect(sanitized).toBe('这里是最终应该给用户的结论。');
  });

  it('会移除能力缺口、首辅视角、原始记录和 runId 这类运行态残留', () => {
    const sanitized = sanitizeFinalUserReply(`
检测到能力缺口，已在本地技能库中找到 3 个候选。
首辅已识别出能力缺口，并在本地技能库中找到 3 个候选。
本地技能库已命中 3 个可直接参考的候选。
首辅视角：我先确认目标边界，再决定是直接回复还是进入多部协作流程。
原始记录：这是运行态内部记录，不应显示给用户。
{
  "runId": "run_1774657114744"
}

这是应该给用户看的最终答复。
    `);

    expect(sanitized).toBe('这是应该给用户看的最终答复。');
  });

  it('会移除户部战报、兵部执行和专家调度这类新增运行态残留', () => {
    const sanitized = sanitizeFinalUserReply(`
当前由增长投放专家主导，并发征询 直播互动专家、技术架构专家、产品策略专家。
户部已开始检索资料与上下文。
户部战报：当前最值得复用的是用户针对业务闭环给出的专业诊断。
兵部已接到任务，正在执行方案。

这是重新整理后的最终回复。
    `);

    expect(sanitized).toBe('这是重新整理后的最终回复。');
  });
});

describe('shapeFinalUserReply', () => {
  it('在存在来源引用时只追加真实引用来源，不拼固定依据套话', () => {
    const shaped = shapeFinalUserReply(
      '这个规划方向基本正确，但商业化目标和验证路径还不够扎实。',
      '1. [网页|official] Playwright 官方文档（playwright.dev）\n2. [文档|official] 版本规划说明（docs.example.com）'
    );

    expect(shaped).toContain('引用来源');
    expect(shaped).toContain('Playwright 官方文档');
    expect(shaped).not.toContain('以上结论优先依据本轮检索到的高可信网页/文档来源整理。');
  });

  it('不会在产品规划类问题下自动补写固定业务套话', () => {
    const shaped = shapeFinalUserReply(
      '这个规划方向不够聚焦，当前更像堆功能而不是围绕商业闭环推进。',
      undefined,
      '这个产品规划怎么样，后续还有什么优化空间'
    );

    expect(shaped).toBe('这个规划方向不够聚焦，当前更像堆功能而不是围绕商业闭环推进。');
  });
});
