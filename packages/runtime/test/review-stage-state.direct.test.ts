import { describe, expect, it } from 'vitest';

import { applyReviewOutcomeState, recordReviewSpecialistFindings } from '../src/flows/review-stage/review-stage-state';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'completed',
    trace: [],
    externalSources: [],
    specialistFindings: [],
    ...overrides
  } as any;
}

function makeReviewed(overrides: Record<string, unknown> = {}) {
  return {
    review: { decision: 'pass', notes: [] },
    evaluation: { shouldRetry: false, notes: [] },
    critiqueResult: undefined,
    specialistFinding: undefined,
    ...overrides
  } as any;
}

describe('review-stage-state (direct)', () => {
  describe('applyReviewOutcomeState', () => {
    it('sets critiqueResult for pass decision', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.critiqueResult).toBeDefined();
      expect(task.critiqueResult.decision).toBe('pass');
    });

    it('sets criticState', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.criticState).toBeDefined();
      expect(task.criticState.decision).toBe('pass_through');
    });

    it('sets finalReviewState', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.finalReviewState).toBeDefined();
      expect(task.finalReviewState.ministry).toBe('xingbu-review');
    });

    it('sets microLoopState', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.microLoopState).toBeDefined();
      expect(task.microLoopState.state).toBe('idle');
    });

    it('sets guardrailState', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.guardrailState).toBeDefined();
      expect(task.guardrailState.verdict).toBe('pass_through');
    });

    it('sets sandboxState', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.sandboxState).toBeDefined();
    });

    it('returns block for blocked review', () => {
      const task = makeTask();
      const reviewed = makeReviewed({
        review: { decision: 'blocked', notes: ['critical issue'] }
      });
      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(decision).toBe('block');
      expect(task.criticState.decision).toBe('rewrite_required');
    });

    it('returns revise_required for shouldRetry', () => {
      const task = makeTask();
      const reviewed = makeReviewed({
        evaluation: { shouldRetry: true, notes: ['needs revision'] }
      });
      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(decision).toBe('revise_required');
    });

    it('returns needs_human_approval when task has pendingApproval', () => {
      const task = makeTask({ pendingApproval: { toolName: 'write_file' } });
      const reviewed = makeReviewed();
      const decision = applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(decision).toBe('needs_human_approval');
    });

    it('uses libu-delivery as reviewMinistry', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      applyReviewOutcomeState(task, reviewed, 'libu-delivery');
      expect(task.finalReviewState.ministry).toBe('libu-delivery');
    });

    it('uses provided critiqueResult summary', () => {
      const task = makeTask();
      const reviewed = makeReviewed({
        critiqueResult: { summary: 'Custom critique summary' }
      });
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.critiqueResult.summary).toBe('Custom critique summary');
    });

    it('handles block decision with failed sandbox status', () => {
      const task = makeTask();
      const reviewed = makeReviewed({
        review: { decision: 'blocked', notes: ['issue'] }
      });
      applyReviewOutcomeState(task, reviewed, 'xingbu-review');
      expect(task.sandboxState.status).toBe('failed');
      expect(task.sandboxState.verdict).toBe('unsafe');
    });
  });

  describe('recordReviewSpecialistFindings', () => {
    it('does nothing when no critiqueResult', () => {
      const task = makeTask();
      const reviewed = makeReviewed();
      recordReviewSpecialistFindings(task, reviewed, 'summary');
      expect(task.specialistFindings).toHaveLength(0);
    });

    it('records specialist finding for lead specialist', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass', summary: 'Passed' },
        specialistLead: { id: 'specialist-1', domain: 'technical-architecture' }
      });
      const reviewed = makeReviewed();
      recordReviewSpecialistFindings(task, reviewed, 'execution summary');
      expect(task.specialistFindings.length).toBeGreaterThan(0);
      expect(task.specialistFindings[0].specialistId).toBe('specialist-1');
      expect(task.specialistFindings[0].role).toBe('lead');
    });

    it('records risk-compliance finding when present as supporting specialist', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass', summary: 'Passed' },
        specialistLead: { id: 'specialist-1', domain: 'technical-architecture' },
        supportingSpecialists: [{ id: 'risk-compliance', domain: 'risk-compliance' }]
      });
      const reviewed = makeReviewed();
      recordReviewSpecialistFindings(task, reviewed, 'execution summary');
      expect(task.specialistFindings.length).toBe(2);
    });

    it('uses reviewed.specialistFinding when available', () => {
      const task = makeTask({
        critiqueResult: { decision: 'pass', summary: 'Passed' },
        specialistLead: { id: 'risk-compliance', domain: 'risk-compliance' }
      });
      const reviewed = makeReviewed({
        specialistFinding: {
          specialistId: 'risk-compliance',
          role: 'lead',
          summary: 'Custom finding'
        }
      });
      recordReviewSpecialistFindings(task, reviewed, 'summary');
      expect(task.specialistFindings.length).toBeGreaterThan(0);
    });

    it('sets risk level based on review decision', () => {
      const task = makeTask({
        critiqueResult: { decision: 'block', summary: 'Blocked' },
        specialistLead: { id: 'specialist-1', domain: 'technical-architecture' }
      });
      const reviewed = makeReviewed({
        review: { decision: 'blocked', notes: ['issue'] }
      });
      recordReviewSpecialistFindings(task, reviewed, 'summary');
      expect(task.specialistFindings[0].riskLevel).toBe('high');
    });
  });
});
