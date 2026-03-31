import { describe, expect, it } from 'vitest';

import { buildLearningCenter } from '../../../src/runtime/centers/runtime-learning-evidence-center';
import { createLearningCenterFixture } from './runtime-learning-evidence-center.fixture';

describe('runtime-learning-evidence-center', () => {
  it('buildLearningCenter 会把 richer learning metadata 暴露给治理面板', async () => {
    const result = await buildLearningCenter(createLearningCenterFixture());

    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'candidate-1',
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的 skill 抽取条件。'],
          conflictDetected: true,
          conflictTargets: ['mem-existing-1'],
          derivedFromLayers: ['L1-session', 'L5-runtime-snapshot'],
          policyMode: 'profile-inherited',
          expertiseSignals: ['user-preference', 'domain-expert']
        })
      ])
    );
    expect(result.quarantinedMemories).toBe(1);
    expect(result.recentQuarantinedMemories).toEqual([
      expect.objectContaining({
        id: 'mem-quarantine-1',
        quarantineReason: 'contains runtime noise',
        quarantineCategory: 'runtime_noise'
      })
    ]);
    expect(result.quarantineCategoryStats).toEqual({ runtime_noise: 1 });
    expect(result.quarantineRestoreSuggestions).toEqual(['清理运行态污染后再恢复。']);
    expect(result.recentCrossCheckEvidence).toEqual([
      expect.objectContaining({
        memoryId: 'mem-quarantine-1',
        id: 'official-rule:runtime-noise',
        summary: '运行态污染规则交叉校验',
        sourceType: 'official_rule',
        trustClass: 'official'
      })
    ]);
    expect(result.learningQueue).toEqual([
      expect.objectContaining({ id: 'queue-1', taskId: 'task-1', status: 'queued', priority: 'high' })
    ]);
    expect(result.counselorSelectorConfigs).toEqual([
      expect.objectContaining({ selectorId: 'payment-selector-v2', domain: 'payment' })
    ]);
    expect(result.learningConflictScan).toEqual(
      expect.objectContaining({
        conflictPairs: expect.arrayContaining([
          expect.objectContaining({ id: 'conflict-1', contextSignature: 'ctx-payment' })
        ]),
        mergeSuggestions: expect.arrayContaining([expect.objectContaining({ conflictId: 'conflict-1' })]),
        manualReviewQueue: expect.arrayContaining([expect.objectContaining({ id: 'review-1' })])
      })
    );
    expect(result.knowledgeStores).toEqual(
      expect.objectContaining({
        wenyuan: expect.objectContaining({ memoryCount: 3, sessionCount: 2 }),
        cangjing: expect.objectContaining({ sourceCount: 5, searchableDocumentCount: 4, blockedDocumentCount: 1 })
      })
    );
    expect(result.recentGovernanceReports).toEqual([
      expect.objectContaining({ taskId: 'task-1', reviewDecision: 'pass', trustAdjustment: 'promote' })
    ]);
    expect(result.capabilityTrustProfiles).toEqual([
      expect.objectContaining({
        capabilityId: 'skill-product-review',
        trustLevel: 'high',
        trustTrend: 'up',
        reportCount: 3,
        promoteCount: 2,
        holdCount: 1,
        downgradeCount: 0,
        lastReviewDecision: 'pass'
      })
    ]);
    expect(result.ministryGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'libu-governance', entityKind: 'ministry' })
    ]);
    expect(result.workerGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'worker-1', entityKind: 'worker' })
    ]);
    expect(result.specialistGovernanceProfiles).toEqual([
      expect.objectContaining({ entityId: 'general-assistant', entityKind: 'specialist' })
    ]);
  });
});
