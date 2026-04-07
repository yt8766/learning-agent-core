import { describe, expect, it } from 'vitest';

import { appendJsonSafety, JSON_SAFETY_PROMPT } from '../../../src/shared/prompts/json-safety-prompt';

describe('json-safety-prompt', () => {
  it('exposes the expected json safety rules', () => {
    expect(JSON_SAFETY_PROMPT).toContain('只输出 JSON 数据本身');
    expect(JSON_SAFETY_PROMPT).toContain('JSON.parse()');
    expect(JSON_SAFETY_PROMPT).toContain('双引号');
    expect(JSON_SAFETY_PROMPT).toContain('trailing comma');
    expect(JSON_SAFETY_PROMPT).toContain('true/false');
  });

  it('appends the normalized safety prompt to an existing prompt', () => {
    const combined = appendJsonSafety('  请输出结构化结果  ');

    expect(combined.startsWith('请输出结构化结果')).toBe(true);
    expect(combined).toContain('【JSON 输出安全规则 - 必须严格遵守】');
    expect(combined).toContain('请输出结构化结果\n【JSON 输出安全规则 - 必须严格遵守】');
    expect(combined.endsWith('8. 数值不要用引号包裹，布尔值使用 true/false。')).toBe(true);
  });
});
