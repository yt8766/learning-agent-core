import { describe, expect, it } from 'vitest';

import { buildLearningCenter } from '../../../src/runtime/centers/runtime-learning-evidence-center';

describe('buildLearningCenter memory governance', () => {
  it('exposes memory resolution candidates for admin governance', async () => {
    const center = await buildLearningCenter({
      tasks: [],
      jobs: [],
      learningQueue: [],
      memoryStatsPromise: Promise.resolve({
        invalidated: 0,
        quarantined: 0,
        recentQuarantined: []
      }),
      invalidatedRulesPromise: Promise.resolve(0),
      crossCheckEvidencePromise: Promise.resolve([]),
      resolutionCandidatesPromise: Promise.resolve([
        {
          id: 'resolution-1',
          conflictKind: 'preference_conflict',
          challengerId: 'memory-new',
          incumbentId: 'memory-old',
          suggestedAction: 'supersede_existing',
          confidence: 0.93,
          rationale: '用户在当前项目里明确纠正了旧偏好。',
          requiresHumanReview: false,
          resolution: 'pending',
          createdAt: '2026-04-16T08:00:00.000Z'
        }
      ]),
      resolveLocalSkillSuggestions: async () => ({
        suggestions: [],
        usedInstalledSkills: []
      })
    });

    expect(center.memoryResolutionCandidates).toEqual([
      expect.objectContaining({
        id: 'resolution-1',
        suggestedAction: 'supersede_existing',
        rationale: '用户在当前项目里明确纠正了旧偏好。'
      })
    ]);
  });
});
