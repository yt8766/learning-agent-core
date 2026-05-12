import { describe, expect, it } from 'vitest';

import { deriveFinalReviewDecision, buildFinalReviewSummary } from '../src/flows/review-stage/review-stage-helpers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'completed',
    trace: [],
    ...overrides
  } as any;
}

describe('review-stage-helpers (direct)', () => {
  describe('deriveFinalReviewDecision', () => {
    it('returns block when review decision is blocked', () => {
      const task = makeTask();
      const review = { decision: 'blocked', notes: ['issue'] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('block');
    });

    it('returns revise_required when shouldRetry is true', () => {
      const task = makeTask();
      const review = { decision: 'pass', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, true)).toBe('revise_required');
    });

    it('returns needs_human_approval when task has pendingApproval', () => {
      const task = makeTask({ pendingApproval: { toolName: 'write_file' } });
      const review = { decision: 'pass', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('needs_human_approval');
    });

    it('returns pass when no blockers', () => {
      const task = makeTask();
      const review = { decision: 'pass', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('pass');
    });

    it('blocked takes priority over shouldRetry', () => {
      const task = makeTask();
      const review = { decision: 'blocked', notes: ['critical'] } as any;
      expect(deriveFinalReviewDecision(task, review, true)).toBe('block');
    });
  });

  describe('buildFinalReviewSummary', () => {
    it('returns summary when provided', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task, 'custom summary')).toBe('custom summary');
    });

    it('returns revise_required message when no summary', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task, undefined, 'revise_required')).toContain('修订');
    });

    it('returns block message when no summary', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task, undefined, 'block')).toContain('阻断');
    });

    it('returns needs_human_approval message when no summary', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task, undefined, 'needs_human_approval')).toContain('人工审批');
    });

    it('returns pass message as default', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task)).toContain('通过');
    });

    it('returns pass message for pass decision', () => {
      const task = makeTask();
      expect(buildFinalReviewSummary(task, undefined, 'pass')).toContain('通过');
    });
  });
});
