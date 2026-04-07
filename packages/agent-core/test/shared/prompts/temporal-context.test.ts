import { describe, expect, it, vi } from 'vitest';

import {
  buildFreshnessAnswerInstruction,
  buildTemporalContextBlock,
  isFreshnessSensitiveGoal
} from '../../../src/utils/prompts/temporal-context';

describe('temporal-context', () => {
  it('detects freshness-sensitive goals', () => {
    expect(isFreshnessSensitiveGoal('最近 AI 有什么新的技术')).toBe(true);
    expect(isFreshnessSensitiveGoal('解释这个仓库的模块结构')).toBe(false);
  });

  it('builds visible freshness answer instruction with absolute date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-26T09:00:00.000Z'));

    expect(buildTemporalContextBlock()).toContain('当前绝对日期：2026-03-26');
    expect(buildFreshnessAnswerInstruction('最近 AI 有什么新的技术')).toContain('信息基准日期：2026-03-26');

    vi.useRealTimers();
  });
});
