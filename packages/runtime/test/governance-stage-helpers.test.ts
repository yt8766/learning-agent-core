import { describe, expect, it } from 'vitest';

import {
  applyCapabilityTrustFromGovernance,
  buildGovernanceReport,
  buildGovernanceScore
} from '../src/flows/ministries/governance-stage-helpers';

describe('governance-stage-helpers', () => {
  const baseEvaluation = {
    score: 75,
    confidence: 'high' as const,
    notes: ['test note'],
    recommendedCandidateIds: [],
    autoConfirmCandidateIds: [],
    sourceSummary: {
      externalSourceCount: 1,
      internalSourceCount: 0,
      reusedMemoryCount: 0,
      reusedRuleCount: 0,
      reusedSkillCount: 0
    },
    success: true,
    shouldWriteMemory: false,
    shouldCreateRule: false,
    shouldExtractSkill: false
  };

  describe('buildGovernanceScore', () => {
    it('returns healthy score when critiqueResult is pass', () => {
      const task = {
        learningEvaluation: { score: 80 },
        critiqueResult: { decision: 'pass' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeGreaterThanOrEqual(80);
      expect(score.status).toBe('healthy');
      expect(score.trustAdjustment).toBe('promote');
      expect(score.ministry).toBe('libu-governance');
    });

    it('reduces score for needs_human_approval decision', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'needs_human_approval' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeLessThan(72);
      expect(score.status).toBe('watch');
    });

    it('reduces score more for revise_required', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'revise_required' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeLessThan(72);
      expect(score.status).not.toBe('healthy');
    });

    it('reduces score significantly for block decision', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'block' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeLessThan(50);
      expect(score.status).toBe('risky');
      expect(score.trustAdjustment).toBe('downgrade');
    });

    it('deducts for micro loops', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'pass' },
        microLoopCount: 3
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      // 72 + 12 (pass) - 18 (3 * 6 micro loops) + 5 (learning targets not present since baseEvaluation.success=true but no shouldWrite/Rule/Skill)
      // Actually: 72 + 12 - 18 = 66
      expect(score.rationale.some((r: string) => r.includes('微循环'))).toBe(true);
    });

    it('deducts for pending approval when not pass', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'revise_required' },
        pendingApproval: { intent: 'write' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.rationale.some((r: string) => r.includes('司礼监'))).toBe(true);
    });

    it('deducts for conflict detected in learning evaluation', () => {
      const task = {
        learningEvaluation: { score: 72, conflictDetected: true },
        critiqueResult: { decision: 'pass' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.rationale.some((r: string) => r.includes('冲突'))).toBe(true);
    });

    it('adds bonus for learning targets when critique passes', () => {
      const task = {
        learningEvaluation: { score: 72 },
        critiqueResult: { decision: 'pass' }
      } as any;
      const evalWithTargets = {
        ...baseEvaluation,
        shouldWriteMemory: true,
        shouldCreateRule: true,
        shouldExtractSkill: true
      };
      const score = buildGovernanceScore(task, evalWithTargets as any);
      expect(score.recommendedLearningTargets).toEqual(['memory', 'rule', 'skill']);
      expect(score.rationale.some((r: string) => r.includes('沉淀'))).toBe(true);
    });

    it('uses default score 72 when no learningEvaluation', () => {
      const task = {
        critiqueResult: { decision: 'pass' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeGreaterThanOrEqual(72);
    });

    it('clamps score between 0 and 100', () => {
      const task = {
        learningEvaluation: { score: 0 },
        critiqueResult: { decision: 'block' },
        microLoopCount: 5
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('returns watch status for scores between 60 and 80', () => {
      const task = {
        learningEvaluation: { score: 68 },
        critiqueResult: { decision: 'pass' }
      } as any;
      const score = buildGovernanceScore(task, baseEvaluation as any);
      // 68 + 12 = 80 which is >= 80, so let's use a lower base
      // Actually 68 + 12 = 80, that's healthy. Let's try 60 + 12 = 72, which is watch
      const task2 = {
        learningEvaluation: { score: 60 },
        critiqueResult: { decision: 'pass' }
      } as any;
      const score2 = buildGovernanceScore(task2, baseEvaluation as any);
      expect(score2.status).toBe('watch');
      expect(score2.trustAdjustment).toBe('hold');
    });
  });

  describe('buildGovernanceReport', () => {
    it('builds a complete report with all sections', () => {
      const task = {
        critiqueResult: { decision: 'pass' },
        finalReviewState: { summary: 'review ok' },
        interruptHistory: [],
        microLoopCount: 0,
        externalSources: [{ id: 'src-1' }, { id: 'src-2' }],
        reusedMemories: [{ id: 'mem-1' }],
        sandboxState: { status: 'passed', verdict: 'safe' }
      } as any;
      const governanceScore = {
        score: 85,
        summary: 'healthy score',
        rationale: ['rationale 1'],
        recommendedLearningTargets: ['memory'],
        trustAdjustment: 'promote' as const
      };
      const evaluation = { ...baseEvaluation, success: true };

      const report = buildGovernanceReport(task, evaluation as any, governanceScore as any);

      expect(report.ministry).toBe('libu-governance');
      expect(report.executionQuality.score).toBe(85);
      expect(report.evidenceSufficiency.score).toBeGreaterThan(55);
      expect(report.sandboxReliability.score).toBe(90);
      expect(report.reviewOutcome.decision).toBe('pass');
      expect(report.interruptLoad.interruptCount).toBe(0);
      expect(report.businessFeedback.score).toBe(82);
      expect(report.trustAdjustment).toBe('promote');
    });

    it('handles blocked review decision', () => {
      const task = {
        critiqueResult: { decision: 'block' },
        finalReviewState: { summary: 'blocked' },
        interruptHistory: [{ id: 'int-1' }],
        microLoopCount: 2,
        sandboxState: { status: 'failed', verdict: 'unsafe' }
      } as any;
      const governanceScore = {
        score: 40,
        summary: 'risky',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'downgrade' as const
      };
      const evaluation = { ...baseEvaluation, success: false };

      const report = buildGovernanceReport(task, evaluation as any, governanceScore as any);

      expect(report.reviewOutcome.decision).toBe('blocked');
      expect(report.sandboxReliability.score).toBe(20);
      expect(report.interruptLoad.interruptCount).toBe(1);
      expect(report.interruptLoad.microLoopCount).toBe(2);
      expect(report.businessFeedback.score).toBe(30);
    });

    it('handles exhausted sandbox state', () => {
      const task = {
        critiqueResult: { decision: 'pass' },
        finalReviewState: {},
        sandboxState: { status: 'exhausted' }
      } as any;
      const governanceScore = {
        score: 70,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold' as const
      };

      const report = buildGovernanceReport(task, baseEvaluation as any, governanceScore as any);
      expect(report.sandboxReliability.score).toBe(35);
    });

    it('handles missing optional task fields', () => {
      const task = {
        finalReviewState: {}
      } as any;
      const governanceScore = {
        score: 70,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold' as const
      };

      const report = buildGovernanceReport(task, baseEvaluation as any, governanceScore as any);
      expect(report.evidenceSufficiency.score).toBeGreaterThan(0);
      expect(report.sandboxReliability.score).toBe(60);
    });
  });

  describe('applyCapabilityTrustFromGovernance', () => {
    it('applies high trust and promote governance profile', () => {
      const task = {
        id: 'task-1',
        capabilityAttachments: [
          {
            id: 'att-1',
            owner: { ownerType: 'ministry-owned', ownerId: 'gongbu-code' }
          }
        ],
        governanceReport: {
          summary: 'healthy',
          trustAdjustment: 'promote',
          reviewOutcome: { decision: 'approved', summary: 'ok' },
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      } as any;

      applyCapabilityTrustFromGovernance(task);

      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('high');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('up');
      expect(task.capabilityAttachments[0].governanceProfile.promoteCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.reportCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.lastTrustAdjustment).toBe('promote');
    });

    it('applies low trust and downgrade for risky governance', () => {
      const task = {
        id: 'task-1',
        capabilityAttachments: [
          {
            id: 'att-1',
            owner: { ownerType: 'specialist-owned', ownerId: 'risk-compliance' }
          }
        ],
        governanceReport: {
          summary: 'risky',
          trustAdjustment: 'downgrade',
          reviewOutcome: { decision: 'blocked', summary: 'blocked' },
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      } as any;

      applyCapabilityTrustFromGovernance(task);

      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('low');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('down');
      expect(task.capabilityAttachments[0].governanceProfile.downgradeCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.blockCount).toBe(1);
    });

    it('applies medium trust for hold adjustment', () => {
      const task = {
        id: 'task-1',
        capabilityAttachments: [
          {
            id: 'att-1',
            owner: { ownerType: 'ministry-owned', ownerId: 'hubu-search' }
          }
        ],
        governanceReport: {
          summary: 'watch',
          trustAdjustment: 'hold',
          reviewOutcome: { decision: 'revise_required', summary: 'needs revision' },
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      } as any;

      applyCapabilityTrustFromGovernance(task);

      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('medium');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('steady');
      expect(task.capabilityAttachments[0].governanceProfile.holdCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.reviseRequiredCount).toBe(1);
    });

    it('skips when no capability attachments', () => {
      const task = {
        governanceReport: {
          trustAdjustment: 'promote',
          reviewOutcome: { decision: 'approved' },
          updatedAt: '',
          summary: ''
        }
      } as any;
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments).toBeUndefined();
    });

    it('skips when no governance report', () => {
      const task = { capabilityAttachments: [{ id: 'a', owner: {} }] } as any;
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].capabilityTrust).toBeUndefined();
    });

    it('does not duplicate report count for same taskId', () => {
      const task = {
        id: 'task-1',
        capabilityAttachments: [
          {
            id: 'att-1',
            owner: {},
            governanceProfile: {
              reportCount: 1,
              promoteCount: 1,
              holdCount: 0,
              downgradeCount: 0,
              passCount: 1,
              reviseRequiredCount: 0,
              blockCount: 0,
              lastTaskId: 'task-1',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'promote',
              recentOutcomes: [
                {
                  taskId: 'task-1',
                  reviewDecision: 'pass',
                  trustAdjustment: 'promote',
                  updatedAt: '2026-04-15T00:00:00.000Z'
                }
              ],
              updatedAt: '2026-04-15T00:00:00.000Z'
            }
          }
        ],
        governanceReport: {
          summary: '',
          trustAdjustment: 'promote',
          reviewOutcome: { decision: 'approved', summary: '' },
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      } as any;

      applyCapabilityTrustFromGovernance(task);

      // should not increment counts since same taskId already recorded
      expect(task.capabilityAttachments[0].governanceProfile.reportCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.promoteCount).toBe(1);
    });
  });
});
