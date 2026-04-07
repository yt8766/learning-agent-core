import { describe, expect, it } from 'vitest';

import { buildStructuredPrompt } from '../../../src/utils/prompts/prompt-template';

describe('buildStructuredPrompt', () => {
  it('builds prompt sections and appends JSON constraints when requested', () => {
    const prompt = buildStructuredPrompt({
      role: '首辅',
      objective: '输出结构化规划',
      inputs: ['goal'],
      rules: ['必须使用中文'],
      fieldRules: ['steps 至少 3 项'],
      output: ['只输出 JSON'],
      json: true
    });

    expect(prompt).toContain('goal');
    expect(prompt).toContain('steps');
    expect(prompt).toContain('JSON');
  });

  it('omits empty sections and skips json safety prompt when json mode is disabled', () => {
    const prompt = buildStructuredPrompt({
      role: '礼部',
      objective: '整理最终答复',
      inputs: [],
      rules: undefined,
      fieldRules: [],
      output: ['保留简洁结构'],
      json: false
    });

    expect(prompt).toContain('你是礼部。');
    expect(prompt).toContain('【任务目标】\n整理最终答复');
    expect(prompt).toContain('【输出要求】\n- 保留简洁结构');
    expect(prompt).not.toContain('【输入说明】');
    expect(prompt).not.toContain('【决策规则】');
    expect(prompt).not.toContain('【字段填充规则】');
    expect(prompt).not.toContain('JSON 输出安全规则');
  });
});
