import { describe, expect, it } from 'vitest';

import { buildManagerDirectReplySystemPrompt } from '../src';

describe('buildManagerDirectReplySystemPrompt', () => {
  it('includes core quality rules for concept-comparison answers', () => {
    const prompt = buildManagerDirectReplySystemPrompt();

    expect(prompt).toContain('核心结论');
    expect(prompt).toContain('对比表');
    expect(prompt).toContain('类比');
    expect(prompt).toContain('底层机制');
    expect(prompt).toContain('可写层');
    expect(prompt).toContain('写时复制');
  });

  it('includes rules preventing orchestration leakage', () => {
    const prompt = buildManagerDirectReplySystemPrompt();

    expect(prompt).toContain('不要启动任务编排');
  });

  it('includes general answer quality rules', () => {
    const prompt = buildManagerDirectReplySystemPrompt();

    expect(prompt).toContain('中文');
    expect(prompt).toContain('常见误区');
    expect(prompt).toContain('命令示例');
  });

  it('appends model identity line when modelId is provided', () => {
    const prompt = buildManagerDirectReplySystemPrompt({ modelId: 'deepseek-v3' });

    expect(prompt).toContain('deepseek-v3');
    expect(prompt).toContain('模型');
  });

  it('omits model identity line when modelId is absent', () => {
    const withModel = buildManagerDirectReplySystemPrompt({ modelId: 'test-model' });
    const withoutModel = buildManagerDirectReplySystemPrompt();

    expect(withModel).toContain('test-model');
    expect(withoutModel).not.toContain('当前运行模型');
  });

  it('uses custom role heading when provided', () => {
    const prompt = buildManagerDirectReplySystemPrompt({ roleHeading: '智能助手' });

    expect(prompt).toContain('智能助手');
  });

  it('defaults to 内阁首辅 role heading', () => {
    const prompt = buildManagerDirectReplySystemPrompt();

    expect(prompt).toContain('内阁首辅');
  });
});
