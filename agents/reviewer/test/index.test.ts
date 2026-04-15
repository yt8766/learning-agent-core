import { describe, expect, it } from 'vitest';

import { ReviewerAgent, ReviewDecisionSchema, XINGBU_REVIEW_SYSTEM_PROMPT, XingbuReviewMinistry } from '../src';

describe('@agent/agents-reviewer', () => {
  it('exports stable reviewer entrypoints', () => {
    expect(ReviewerAgent).toBeTypeOf('function');
    expect(XingbuReviewMinistry).toBeTypeOf('function');
    expect(ReviewDecisionSchema.safeParse({}).success).toBe(false);
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('只输出符合 Schema 的 JSON');
  });
});
