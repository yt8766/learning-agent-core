import { describe, expect, it } from 'vitest';

import { computePriorityScore } from '../../../src/runtime/briefings/runtime-tech-briefing-ranking-policy';
import type { TechBriefingItem } from '../../../src/runtime/briefings/runtime-tech-briefing.types';

function createItem(overrides: Partial<TechBriefingItem>): TechBriefingItem {
  return {
    id: 'item-1',
    category: 'frontend-security',
    title: 'Axios supply chain incident',
    url: 'https://example.com/axios',
    publishedAt: '2026-03-31T00:00:00.000Z',
    sourceName: 'Example',
    sourceUrl: 'https://example.com',
    sourceType: 'security-page',
    authorityTier: 'top-tier-media',
    sourceGroup: 'authority',
    contentKind: 'incident',
    summary: 'axios incident summary',
    confidence: 0.9,
    sourceLabel: 'Example',
    relevanceReason: '命中当前关注技术域：axios',
    technicalityScore: 5,
    crossVerified: true,
    ...overrides
  };
}

describe('runtime tech briefing ranking policy', () => {
  it('为高影响且命中技术栈的条目返回更高优先级分数', () => {
    const highPriority = computePriorityScore(
      'frontend-security',
      createItem({
        title: 'Axios supply chain incident',
        summary: 'axios package supply chain compromise'
      })
    );

    const lowerPriority = computePriorityScore(
      'frontend-security',
      createItem({
        title: 'Generic frontend update',
        summary: 'minor docs refresh for frontend guidance'
      })
    );

    expect(highPriority).toBeGreaterThan(lowerPriority);
  });
});
