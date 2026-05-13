import { describe, expect, it } from 'vitest';

import { applyReviewOutcomeState, recordReviewSpecialistFindings } from '../src/flows/review-stage/review-stage-state';

describe('review-stage-state', () => {
  describe('applyReviewOutcomeState', () => {
    const makeBaseTask = () =>
      ({
        id: 'task-1',
        learningEvaluation: { score: 70 },
        externalSources: [{ id: 'src-1' }, { id: 'src-2' }],
        microLoopCount: 0,
        maxMicroLoops: 2
      }) as any;

    const makeReviewed = (decision: string, shouldRetry = false) =>
      ({
        review: { decision, notes: ['review note'] },
        evaluation: {
          shouldRetry,
          notes: ['eval note'],
          score: 80,
          confidence: 'high',
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 1,
            internalSourceCount: 0,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        critiqueResult: undefined,
        specialistFinding: undefined,
        contractMeta: {
          contractName: 'review-decision',
          contractVersion: 'review-decision.v1',
          parseStatus: 'success',
          fallbackUsed: false
        }
      }) as any;

    it('applies pass state correctly', () => {
      const task = makeBaseTask();
      const reviewed = makeReviewed('approved');

      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(decision).toBe('pass');
      expect(task.critiqueResult).toBeDefined();
      expect(task.critiqueResult!.decision).toBe('pass');
      expect(task.finalReviewState!.decision).toBe('pass');
      expect(task.finalReviewState!.interruptRequired).toBe(false);
      expect(task.finalReviewState!.deliveryStatus).toBe('pending');
      expect(task.guardrailState!.verdict).toBe('pass_through');
      expect(task.sandboxState!.status).toBe('passed');
      expect(task.microLoopState!.state).toBe('idle');
    });

    it('applies block state for blocked review', () => {
      const task = makeBaseTask();
      const reviewed = makeReviewed('blocked');

      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(decision).toBe('block');
      expect(task.critiqueResult!.decision).toBe('block');
      expect(task.finalReviewState!.interruptRequired).toBe(true);
      expect(task.finalReviewState!.deliveryStatus).toBe('interrupted');
      expect(task.guardrailState!.verdict).toBe('block');
      expect(task.sandboxState!.status).toBe('failed');
      expect(task.sandboxState!.verdict).toBe('unsafe');
      expect(task.criticState!.decision).toBe('rewrite_required');
    });

    it('applies revise_required when shouldRetry is true', () => {
      const task = makeBaseTask();
      const reviewed = makeReviewed('approved', true);

      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(decision).toBe('revise_required');
      expect(task.finalReviewState!.interruptRequired).toBe(true);
      expect(task.guardrailState!.verdict).toBe('rewrite_required');
    });

    it('applies needs_human_approval when task has pending approval', () => {
      const task = { ...makeBaseTask(), pendingApproval: { intent: 'write' } };
      const reviewed = makeReviewed('approved');

      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(decision).toBe('needs_human_approval');
      expect(task.finalReviewState!.interruptRequired).toBe(true);
    });

    it('preserves existing createdAt timestamps', () => {
      const task = {
        ...makeBaseTask(),
        criticState: { createdAt: '2026-04-15T00:00:00.000Z' },
        finalReviewState: { createdAt: '2026-04-15T00:00:00.000Z' }
      };
      const reviewed = makeReviewed('approved');

      applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(task.criticState!.createdAt).toBe('2026-04-15T00:00:00.000Z');
      expect(task.finalReviewState!.createdAt).toBe('2026-04-15T00:00:00.000Z');
    });

    it('uses critiqueResult summary when provided', () => {
      const task = makeBaseTask();
      const reviewed = makeReviewed('approved');
      reviewed.critiqueResult = { summary: 'custom critique summary', blockingIssues: [] };

      applyReviewOutcomeState(task, reviewed, 'xingbu-review');

      expect(task.critiqueResult!.summary).toBe('custom critique summary');
    });
  });

  describe('recordReviewSpecialistFindings', () => {
    it('records lead specialist finding when specialistLead exists', () => {
      const task = {
        critiqueResult: { decision: 'pass', summary: 'ok' },
        specialistLead: { id: 'tech-arch', domain: 'technical-architecture' },
        externalSources: [{ id: 'src-1' }],
        routeConfidence: 0.85
      } as any;
      const reviewed = {
        review: { decision: 'approved', notes: [] },
        evaluation: { shouldRetry: false, notes: [] }
      } as any;

      recordReviewSpecialistFindings(task, reviewed, 'execution summary');

      expect(task.specialistFindings).toBeDefined();
      expect(task.specialistFindings).toHaveLength(1);
      expect(task.specialistFindings[0].specialistId).toBe('tech-arch');
      expect(task.specialistFindings[0].role).toBe('lead');
    });

    it('skips when no critiqueResult', () => {
      const task = { specialistLead: { id: 'test' } } as any;
      const reviewed = { review: { decision: 'approved' }, evaluation: { shouldRetry: false } } as any;

      recordReviewSpecialistFindings(task, reviewed, 'summary');
      expect(task.specialistFindings).toBeUndefined();
    });

    it('skips when no specialistLead and no risk-compliance supporter', () => {
      const task = {
        critiqueResult: { decision: 'pass', summary: 'ok' },
        supportingSpecialists: []
      } as any;
      const reviewed = { review: { decision: 'approved' }, evaluation: { shouldRetry: false } } as any;

      recordReviewSpecialistFindings(task, reviewed, 'summary');
      expect(task.specialistFindings).toBeUndefined();
    });

    it('records risk-compliance finding when it is a supporting specialist', () => {
      const task = {
        critiqueResult: { decision: 'pass', summary: 'ok' },
        supportingSpecialists: [{ id: 'risk-compliance', domain: 'risk-compliance' }]
      } as any;
      const reviewed = {
        review: { decision: 'approved', notes: [] },
        evaluation: { shouldRetry: false, notes: [] }
      } as any;

      recordReviewSpecialistFindings(task, reviewed, 'summary');

      expect(task.specialistFindings).toBeDefined();
      const finding = task.specialistFindings.find((f: any) => f.specialistId === 'risk-compliance');
      expect(finding).toBeDefined();
      expect(finding.role).toBe('support');
    });

    it('uses high risk level for blocked review decision', () => {
      const task = {
        critiqueResult: { decision: 'pass', summary: 'ok' },
        specialistLead: { id: 'lead-1', domain: 'test-domain' },
        externalSources: []
      } as any;
      const reviewed = {
        review: { decision: 'blocked', notes: ['blocked note'] },
        evaluation: { shouldRetry: false, notes: [] }
      } as any;

      recordReviewSpecialistFindings(task, reviewed, 'summary');

      expect(task.specialistFindings[0].riskLevel).toBe('high');
    });

    it('uses medium risk level for shouldRetry', () => {
      const task = {
        critiqueResult: { decision: 'pass', summary: 'ok' },
        specialistLead: { id: 'lead-1', domain: 'test-domain' },
        externalSources: []
      } as any;
      const reviewed = {
        review: { decision: 'approved', notes: [] },
        evaluation: { shouldRetry: true, notes: [] }
      } as any;

      recordReviewSpecialistFindings(task, reviewed, 'summary');

      expect(task.specialistFindings[0].riskLevel).toBe('medium');
    });
  });
});
