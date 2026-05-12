import { describe, expect, it } from 'vitest';

import {
  buildGovernanceScore,
  buildGovernanceReport,
  applyCapabilityTrustFromGovernance
} from '../src/flows/ministries/governance-stage-helpers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'completed',
    trace: [],
    externalSources: [],
    reusedMemories: [],
    capabilityAttachments: [],
    interruptHistory: [],
    microLoopCount: 0,
    maxMicroLoops: 3,
    ...overrides
  } as any;
}

function makeEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    shouldWriteMemory: false,
    shouldCreateRule: false,
    shouldExtractSkill: false,
    ...overrides
  } as any;
}

describe('governance-stage-helpers (direct)', () => {
  describe('buildGovernanceScore', () => {
    it('produces a healthy score for a clean task with pass critique', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.score).toBeGreaterThanOrEqual(80);
      expect(score.status).toBe('healthy');
      expect(score.ministry).toBe('libu-governance');
    });

    it('produces a risky score for block critique', () => {
      const task = makeTask({
        critiqueResult: { decision: 'block' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.score).toBeLessThan(60);
      expect(score.status).toBe('risky');
    });

    it('produces a risky score for revise_required critique', () => {
      const task = makeTask({
        critiqueResult: { decision: 'revise_required' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      // 72 - 18 = 54, which is risky (< 60)
      expect(score.status).toBe('risky');
    });

    it('deducts for needs_human_approval', () => {
      const task = makeTask({
        critiqueResult: { decision: 'needs_human_approval' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.rationale.some(r => r.includes('人工审批'))).toBe(true);
    });

    it('deducts for micro loops', () => {
      const task = makeTask({
        microLoopCount: 3,
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.rationale.some(r => r.includes('微循环'))).toBe(true);
    });

    it('deducts for pending approval without pass', () => {
      const task = makeTask({
        pendingApproval: { toolName: 'write_file' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.rationale.some(r => r.includes('司礼监'))).toBe(true);
    });

    it('deducts for learning evaluation conflict', () => {
      const task = makeTask({
        learningEvaluation: { score: 72, conflictDetected: true }
      });
      const evaluation = makeEvaluation();
      const score = buildGovernanceScore(task, evaluation);
      expect(score.rationale.some(r => r.includes('冲突'))).toBe(true);
    });

    it('adds recommended learning targets', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass' },
        learningEvaluation: { score: 72 }
      });
      const evaluation = makeEvaluation({
        shouldWriteMemory: true,
        shouldCreateRule: true,
        shouldExtractSkill: true
      });
      const score = buildGovernanceScore(task, evaluation);
      expect(score.recommendedLearningTargets).toContain('memory');
      expect(score.recommendedLearningTargets).toContain('rule');
      expect(score.recommendedLearningTargets).toContain('skill');
    });

    it('clamps score between 0 and 100', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass' },
        learningEvaluation: { score: 95 }
      });
      const evaluation = makeEvaluation({ shouldWriteMemory: true, shouldCreateRule: true });
      const score = buildGovernanceScore(task, evaluation);
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('sets trustAdjustment based on status', () => {
      const healthyTask = makeTask({
        critiqueResult: { decision: 'pass' },
        learningEvaluation: { score: 80 }
      });
      expect(buildGovernanceScore(healthyTask, makeEvaluation()).trustAdjustment).toBe('promote');

      const riskyTask = makeTask({
        critiqueResult: { decision: 'block' },
        learningEvaluation: { score: 40 }
      });
      expect(buildGovernanceScore(riskyTask, makeEvaluation()).trustAdjustment).toBe('downgrade');

      // score 82 - 18 = 64 -> watch -> hold
      const watchTask = makeTask({
        critiqueResult: { decision: 'revise_required' },
        learningEvaluation: { score: 82 }
      });
      expect(buildGovernanceScore(watchTask, makeEvaluation()).trustAdjustment).toBe('hold');
    });

    it('uses default score of 72 when no learningEvaluation', () => {
      const task = makeTask({ critiqueResult: { decision: 'pass' } });
      const score = buildGovernanceScore(task, makeEvaluation());
      expect(score.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('buildGovernanceReport', () => {
    it('creates a full governance report', () => {
      const task = makeTask({
        externalSources: [{ id: 'src-1' }, { id: 'src-2' }],
        reusedMemories: [{ id: 'mem-1' }],
        sandboxState: { status: 'passed' },
        finalReviewState: { summary: 'Review complete' }
      });
      const evaluation = makeEvaluation();
      const governanceScore = {
        score: 85,
        status: 'healthy',
        summary: 'Healthy',
        rationale: ['Good'],
        recommendedLearningTargets: [],
        trustAdjustment: 'promote'
      } as any;
      const report = buildGovernanceReport(task, evaluation, governanceScore);
      expect(report.ministry).toBe('libu-governance');
      expect(report.executionQuality.score).toBe(85);
      expect(report.evidenceSufficiency.score).toBeGreaterThan(55);
      expect(report.sandboxReliability.score).toBe(90);
      expect(report.businessFeedback.score).toBe(82);
    });

    it('adjusts sandbox score for exhausted status', () => {
      const task = makeTask({ sandboxState: { status: 'exhausted' } });
      const report = buildGovernanceReport(task, makeEvaluation(), {
        score: 60,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold'
      } as any);
      expect(report.sandboxReliability.score).toBe(35);
    });

    it('adjusts sandbox score for failed status', () => {
      const task = makeTask({ sandboxState: { status: 'failed' } });
      const report = buildGovernanceReport(task, makeEvaluation(), {
        score: 60,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold'
      } as any);
      expect(report.sandboxReliability.score).toBe(20);
    });

    it('adjusts business feedback for failed evaluation', () => {
      const task = makeTask();
      const evaluation = makeEvaluation({ success: false });
      const report = buildGovernanceReport(task, evaluation, {
        score: 60,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold'
      } as any);
      expect(report.businessFeedback.score).toBe(58);
    });

    it('adjusts business feedback for blocked review', () => {
      const task = makeTask({
        critiqueResult: { decision: 'block' }
      });
      const evaluation = makeEvaluation({ success: false });
      const report = buildGovernanceReport(task, evaluation, {
        score: 40,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'downgrade'
      } as any);
      expect(report.businessFeedback.score).toBe(30);
    });

    it('reports interrupt load correctly', () => {
      const task = makeTask({
        interruptHistory: [{ id: 'i1' }, { id: 'i2' }],
        microLoopCount: 1
      });
      const report = buildGovernanceReport(task, makeEvaluation(), {
        score: 60,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'hold'
      } as any);
      expect(report.interruptLoad.interruptCount).toBe(2);
      expect(report.interruptLoad.microLoopCount).toBe(1);
    });

    it('reports zero interrupt load for clean task', () => {
      const task = makeTask();
      const report = buildGovernanceReport(task, makeEvaluation(), {
        score: 80,
        summary: '',
        rationale: [],
        recommendedLearningTargets: [],
        trustAdjustment: 'promote'
      } as any);
      expect(report.interruptLoad.interruptCount).toBe(0);
      expect(report.interruptLoad.microLoopCount).toBe(0);
    });
  });

  describe('applyCapabilityTrustFromGovernance', () => {
    it('sets high trust for promote adjustment', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true
          }
        ],
        governanceReport: {
          trustAdjustment: 'promote',
          summary: 'Good',
          reviewOutcome: { decision: 'approved', summary: 'Passed' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('high');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('up');
    });

    it('sets low trust for downgrade adjustment', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true
          }
        ],
        governanceReport: {
          trustAdjustment: 'downgrade',
          summary: 'Bad',
          reviewOutcome: { decision: 'blocked', summary: 'Blocked' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('low');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('down');
    });

    it('sets medium trust for hold adjustment', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true
          }
        ],
        governanceReport: {
          trustAdjustment: 'hold',
          summary: 'OK',
          reviewOutcome: { decision: 'retry', summary: 'Retry' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].capabilityTrust.trustLevel).toBe('medium');
      expect(task.capabilityAttachments[0].capabilityTrust.trustTrend).toBe('steady');
    });

    it('does nothing when no capabilityAttachments', () => {
      const task = makeTask({ capabilityAttachments: undefined });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments).toBeUndefined();
    });

    it('does nothing when no governanceReport', () => {
      const task = makeTask({
        capabilityAttachments: [{ id: 'a1' }]
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].capabilityTrust).toBeUndefined();
    });

    it('updates governanceProfile on attachment', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true
          }
        ],
        governanceReport: {
          trustAdjustment: 'promote',
          summary: 'Good',
          reviewOutcome: { decision: 'approved', summary: 'Passed' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].governanceProfile).toBeDefined();
      expect(task.capabilityAttachments[0].governanceProfile.reportCount).toBe(1);
      expect(task.capabilityAttachments[0].governanceProfile.promoteCount).toBe(1);
    });

    it('increments existing governanceProfile counts', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true,
            governanceProfile: {
              reportCount: 2,
              promoteCount: 1,
              holdCount: 1,
              downgradeCount: 0,
              passCount: 2,
              reviseRequiredCount: 0,
              blockCount: 0,
              lastTaskId: 'other-task',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'promote',
              recentOutcomes: [],
              updatedAt: '2025-12-01T00:00:00Z'
            }
          }
        ],
        governanceReport: {
          trustAdjustment: 'hold',
          summary: 'OK',
          reviewOutcome: { decision: 'retry', summary: 'Retry' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].governanceProfile.reportCount).toBe(3);
      expect(task.capabilityAttachments[0].governanceProfile.holdCount).toBe(2);
    });

    it('does not increment counts for same taskId', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'a1',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            enabled: true,
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
                  updatedAt: '2025-12-01T00:00:00Z'
                }
              ],
              updatedAt: '2025-12-01T00:00:00Z'
            }
          }
        ],
        governanceReport: {
          trustAdjustment: 'hold',
          summary: 'OK',
          reviewOutcome: { decision: 'retry', summary: 'Retry' },
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      applyCapabilityTrustFromGovernance(task);
      expect(task.capabilityAttachments[0].governanceProfile.reportCount).toBe(1);
    });
  });
});
