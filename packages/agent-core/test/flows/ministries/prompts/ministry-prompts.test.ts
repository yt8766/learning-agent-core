import { describe, expect, it } from 'vitest';

import {
  buildResearchUserPrompt,
  HUBU_RESEARCH_SYSTEM_PROMPT
} from '../../../../src/flows/ministries/hubu-search/prompts/research-prompts';
import { XINGBU_REVIEW_SYSTEM_PROMPT } from '../../../../src/flows/ministries/xingbu-review/prompts/review-prompts';

describe('ministry prompt conventions', () => {
  it('keeps hubu research prompt schema-first and stepwise', () => {
    expect(HUBU_RESEARCH_SYSTEM_PROMPT).toContain('可被主链直接消费的结构化研究结论');
    expect(HUBU_RESEARCH_SYSTEM_PROMPT).toContain('只输出符合 Schema 的 JSON');
    expect(HUBU_RESEARCH_SYSTEM_PROMPT).toContain('不要输出 Markdown，不要输出额外解释');
    expect(HUBU_RESEARCH_SYSTEM_PROMPT).toContain('信息不足时保持保守');

    const userPrompt = buildResearchUserPrompt({
      goal: '分析聊天技能复用策略'
    });
    expect(userPrompt).toContain('请先检查输入，再归纳研究结论，最后输出 JSON。');
  });

  it('keeps xingbu review prompt focused on staged risk review', () => {
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('先识别阻断风险，再识别可修订问题，最后给出决策');
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('critiqueResult.contractVersion 必须输出为 critique-result.v1');
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('不要输出 Markdown，不要输出额外解释');
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('approved 对应 pass');
  });
});
