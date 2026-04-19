import { describe, expect, it } from 'vitest';
import { buildLearningCenter, buildLearningCenterSummary } from '../src/runtime/runtime-learning-center';

function createLearningFixture() {
  return {
    tasks: [
      {
        id: 'task-1',
        goal: '主聊天区只显示最终答复',
        currentMinistry: 'libu-governance',
        currentWorker: 'worker-1',
        updatedAt: '2026-03-28T00:00:00.000Z',
        learningCandidates: [
          {
            id: 'candidate-1',
            type: 'memory',
            summary: '用户偏好主聊天区只显示最终答复',
            status: 'pending_confirmation',
            autoConfirmEligible: true,
            createdAt: '2026-03-28T00:00:00.000Z'
          }
        ],
        learningEvaluation: {
          score: 88,
          confidence: 'high',
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的 skill 抽取条件。'],
          conflictDetected: true,
          conflictTargets: ['mem-existing-1'],
          derivedFromLayers: ['L1-session', 'L5-runtime-snapshot'],
          policyMode: 'profile-inherited',
          expertiseSignals: ['user-preference', 'domain-expert']
        },
        governanceReport: {
          summary: '治理链认为本轮结果可继续提升信任。',
          reviewOutcome: { decision: 'pass', summary: '终审通过。' },
          trustAdjustment: 'promote',
          evidenceSufficiency: { score: 87 },
          sandboxReliability: { score: 90 }
        },
        capabilityAttachments: [
          {
            id: 'skill-product-review',
            displayName: 'Product Review',
            capabilityTrust: {
              trustLevel: 'high',
              trustTrend: 'up',
              lastReason: '终审通过。',
              updatedAt: '2026-03-28T00:20:00.000Z'
            },
            governanceProfile: {
              reportCount: 3,
              promoteCount: 2,
              holdCount: 1,
              downgradeCount: 0,
              lastTaskId: 'task-1',
              lastReviewDecision: 'pass',
              updatedAt: '2026-03-28T00:20:00.000Z'
            },
            updatedAt: '2026-03-28T00:20:00.000Z'
          }
        ]
      }
    ] as any,
    jobs: [],
    learningQueue: [
      {
        id: 'queue-1',
        taskId: 'task-1',
        status: 'queued',
        mode: 'task-learning',
        queuedAt: '2026-03-28T00:10:00.000Z',
        updatedAt: '2026-03-28T00:10:00.000Z',
        priority: 'high'
      }
    ],
    memoryStatsPromise: Promise.resolve({
      invalidated: 0,
      quarantined: 1,
      recentQuarantined: [
        {
          id: 'mem-quarantine-1',
          summary: '被运行态污染的经验',
          quarantineReason: 'contains runtime noise',
          quarantineCategory: 'runtime_noise',
          quarantineRestoreSuggestion: '清理运行态污染后再恢复。'
        }
      ]
    }),
    invalidatedRulesPromise: Promise.resolve(0),
    crossCheckEvidencePromise: Promise.resolve([
      {
        memoryId: 'mem-quarantine-1',
        record: {
          id: 'official-rule:runtime-noise',
          summary: '运行态污染规则交叉校验',
          sourceType: 'official_rule',
          trustClass: 'official'
        }
      }
    ]),
    governanceSnapshotPromise: Promise.resolve({
      governance: {
        ministryGovernanceProfiles: [
          {
            entityId: 'libu-governance',
            displayName: 'libu-governance',
            entityKind: 'ministry',
            trustLevel: 'high',
            trustTrend: 'up',
            reportCount: 2,
            promoteCount: 2,
            holdCount: 0,
            downgradeCount: 0,
            updatedAt: '2026-03-28T00:20:00.000Z'
          }
        ],
        counselorSelectorConfigs: [
          {
            selectorId: 'payment-selector-v2',
            domain: 'payment',
            enabled: true,
            strategy: 'task-type',
            candidateIds: ['payment-counselor-v1'],
            defaultCounselorId: 'payment-counselor-v1',
            createdAt: '2026-03-28T01:00:00.000Z',
            updatedAt: '2026-03-28T01:00:00.000Z'
          }
        ],
        learningConflictScan: {
          scannedAt: '2026-03-28T02:00:00.000Z',
          conflictPairs: [
            {
              id: 'conflict-1',
              contextSignature: 'ctx-payment',
              memoryIds: ['mem-1', 'mem-2'],
              severity: 'low',
              resolution: 'lightweight_review_required',
              status: 'open',
              effectivenessSpread: 0.08
            }
          ],
          mergeSuggestions: [],
          manualReviewQueue: []
        }
      }
    }),
    resolutionCandidatesPromise: Promise.resolve([]),
    resolveLocalSkillSuggestions: async () => ({
      suggestions: [],
      profile: 'personal'
    }),
    deriveRuleCandidates: () => [
      {
        id: 'rule-1',
        status: 'pending_confirmation',
        autoConfirmEligible: false,
        createdAt: '2026-03-29T00:00:00.000Z'
      }
    ]
  };
}

describe('runtime-learning-center', () => {
  it('builds full learning center projection with derived rule candidates', async () => {
    const result = await buildLearningCenter(createLearningFixture());

    expect(result.totalCandidates).toBe(2);
    expect(result.pendingCandidates).toBe(2);
    expect(result.quarantineCategoryStats).toEqual({ runtime_noise: 1 });
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'rule-1' }),
        expect.objectContaining({ id: 'candidate-1' })
      ])
    );
    expect(result.counselorSelectorConfigs).toEqual([
      expect.objectContaining({ selectorId: 'payment-selector-v2', domain: 'payment' })
    ]);
  });

  it('builds summary projection with derived rule candidates', async () => {
    const result = await buildLearningCenterSummary(createLearningFixture());

    expect(result.totalCandidates).toBe(2);
    expect(result.pendingCandidates).toBe(2);
    expect(result.quarantinedMemories).toBe(1);
    expect(result.autoConfirmableCandidates).toBe(1);
  });
});
