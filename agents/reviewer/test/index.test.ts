import { describe, expect, it } from 'vitest';

import { ReviewerAgent, ReviewDecisionSchema, XINGBU_REVIEW_SYSTEM_PROMPT, XingbuReviewMinistry } from '../src';
import { ReviewerAgent as canonicalReviewerAgent } from '../src/flows/chat/nodes/reviewer-node';
import { XingbuReviewMinistry as canonicalXingbuReviewMinistry } from '../src/flows/ministries/xingbu-review-ministry';
import { XINGBU_REVIEW_SYSTEM_PROMPT as canonicalReviewPrompt } from '../src/flows/ministries/xingbu-review/prompts/review-prompts';
import { ReviewDecisionSchema as canonicalReviewDecisionSchema } from '../src/flows/ministries/xingbu-review/schemas/review-decision-schema';

describe('@agent/agents-reviewer root exports', () => {
  it('keeps stable reviewer entrypoints wired to canonical hosts', () => {
    expect(ReviewerAgent).toBe(canonicalReviewerAgent);
    expect(XingbuReviewMinistry).toBe(canonicalXingbuReviewMinistry);
    expect(ReviewDecisionSchema).toBe(canonicalReviewDecisionSchema);
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toBe(canonicalReviewPrompt);
    expect(ReviewerAgent).toBeTypeOf('function');
    expect(XingbuReviewMinistry).toBeTypeOf('function');
    expect(ReviewDecisionSchema.safeParse({}).success).toBe(false);
    expect(XINGBU_REVIEW_SYSTEM_PROMPT).toContain('只输出符合 Schema 的 JSON');
  });
});
