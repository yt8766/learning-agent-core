import { describe, expect, it } from 'vitest';

import { buildTechBriefingRun } from '../../../src/runtime/briefing/briefing-delivery';

describe('runtime tech briefing delivery helpers', () => {
  it('builds a partial run record when only part of categories are delivered', () => {
    const run = buildTechBriefingRun({
      now: new Date('2026-04-16T00:00:00.000Z'),
      categories: ['ai-tech', 'backend-tech'],
      finalizedCategories: [
        {
          category: 'ai-tech',
          title: 'ai',
          status: 'sent',
          itemCount: 1,
          sent: true,
          emptyDigest: false,
          sourcesChecked: []
        },
        {
          category: 'backend-tech',
          title: 'backend',
          status: 'failed',
          itemCount: 0,
          sent: false,
          emptyDigest: false,
          sourcesChecked: []
        }
      ],
      digest: {
        title: 'briefing',
        mode: 'per-category',
        content: 'content',
        categoryCount: 2,
        newCount: 1,
        updateCount: 0,
        crossRunSuppressedCount: 0,
        sameRunMergedCount: 0,
        overflowCollapsedCount: 0,
        sourcesChecked: {
          official: [],
          authority: [],
          community: []
        }
      }
    });

    expect(run.status).toBe('partial');
    expect(run.digest?.mode).toBe('per-category');
    expect(run.id).toHaveLength(12);
  });
});
