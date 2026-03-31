import { describe, expect, it } from 'vitest';

import { buildStructuredPrompt } from '../../../src/shared/prompts/prompt-template';

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
});
