import { describe, expect, it } from 'vitest';

import {
  CritiqueResultSchema,
  ReviewerAgent,
  ReviewDecisionSchema,
  SpecialistFindingSchema,
  XINGBU_REVIEW_SYSTEM_PROMPT,
  XingbuReviewMinistry,
  normalizeCritiqueResult
} from '../src';
import { ReviewerAgent as canonicalReviewerAgent } from '../src/flows/chat/nodes/reviewer-node';
import { XingbuReviewMinistry as canonicalXingbuReviewMinistry } from '../src/flows/ministries/xingbu-review-ministry';
import { XINGBU_REVIEW_SYSTEM_PROMPT as canonicalReviewPrompt } from '../src/flows/ministries/xingbu-review/prompts/review-prompts';
import { ReviewDecisionSchema as canonicalReviewDecisionSchema } from '../src/flows/ministries/xingbu-review/schemas/review-decision-schema';
import { SpecialistFindingSchema as canonicalSpecialistFindingSchema } from '../src/types/specialist-finding.schema';

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

  it('exposes review contracts and helpers from the reviewer package boundary', () => {
    expect(SpecialistFindingSchema).toBe(canonicalSpecialistFindingSchema);
    expect(
      SpecialistFindingSchema.safeParse({
        specialistId: 'risk-compliance',
        role: 'lead',
        contractVersion: 'specialist-finding.v1',
        source: 'critique',
        stage: 'review',
        summary: '需要补充审批证据。',
        domain: 'risk-compliance'
      }).success
    ).toBe(true);
    expect(
      normalizeCritiqueResult({
        decision: 'block',
        blockingIssues: [' 缺少审批 ', '缺少审批']
      })
    ).toEqual({
      contractVersion: 'critique-result.v1',
      decision: 'block',
      summary: '刑部判定当前方案存在阻断问题。',
      blockingIssues: ['缺少审批'],
      constraints: undefined,
      evidenceRefs: undefined,
      shouldBlockEarly: true
    });
    expect(CritiqueResultSchema.safeParse({}).success).toBe(false);
  });
});
