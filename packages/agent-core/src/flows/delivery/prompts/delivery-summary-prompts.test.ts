import { describe, expect, it, vi } from 'vitest';

import { buildDeliverySummaryUserPrompt } from './delivery-summary-prompts';

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
});
