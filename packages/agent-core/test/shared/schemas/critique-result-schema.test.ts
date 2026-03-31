import { describe, expect, it } from 'vitest';

import { normalizeCritiqueResult } from '../../../src/shared/schemas/critique-result-schema';

describe('critique result schema', () => {
  it('会归一化列表并根据 decision 补摘要与 block early', () => {
    const result = normalizeCritiqueResult({
      decision: 'block',
      blockingIssues: ['  命中关键风险  ', '命中关键风险'],
      constraints: ['  必须人工确认  ', ''],
      evidenceRefs: [' ev_1 ', 'ev_1']
    });

    expect(result).toEqual({
      contractVersion: 'critique-result.v1',
      decision: 'block',
      summary: '刑部判定当前方案存在阻断问题。',
      blockingIssues: ['命中关键风险'],
      constraints: ['必须人工确认'],
      evidenceRefs: ['ev_1'],
      shouldBlockEarly: true
    });
  });
});
