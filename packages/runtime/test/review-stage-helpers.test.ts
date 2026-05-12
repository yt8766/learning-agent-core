import { describe, expect, it } from 'vitest';

import { buildFinalReviewSummary, deriveFinalReviewDecision } from '../src/flows/review-stage/review-stage-helpers';

describe('review-stage-helpers', () => {
  describe('deriveFinalReviewDecision', () => {
    it('returns block when review decision is blocked', () => {
      const task = {} as any;
      const review = { decision: 'blocked', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('block');
    });

    it('returns revise_required when shouldRetry is true', () => {
      const task = {} as any;
      const review = { decision: 'approved', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, true)).toBe('revise_required');
    });

    it('returns needs_human_approval when task has pending approval', () => {
      const task = { pendingApproval: { intent: 'write_file' } } as any;
      const review = { decision: 'approved', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('needs_human_approval');
    });

    it('returns pass when no blocking conditions', () => {
      const task = {} as any;
      const review = { decision: 'approved', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, false)).toBe('pass');
    });

    it('blocked takes precedence over shouldRetry', () => {
      const task = {} as any;
      const review = { decision: 'blocked', notes: [] } as any;
      expect(deriveFinalReviewDecision(task, review, true)).toBe('block');
    });
  });

  describe('buildFinalReviewSummary', () => {
    it('returns provided summary when present', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task, 'custom summary')).toBe('custom summary');
    });

    it('returns revise message for revise_required decision', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task, undefined, 'revise_required')).toBe('刑部认为当前草稿仍需修订。');
    });

    it('returns block message for block decision', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task, undefined, 'block')).toBe('刑部判定当前方案存在阻断问题。');
    });

    it('returns approval message for needs_human_approval decision', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task, undefined, 'needs_human_approval')).toBe(
        '刑部认为当前动作需要人工审批后才能继续。'
      );
    });

    it('returns pass message for default/pass decision', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task, undefined, 'pass')).toBe('刑部审查通过。');
    });

    it('returns pass message when no decision and no summary', () => {
      const task = {} as any;
      expect(buildFinalReviewSummary(task)).toBe('刑部审查通过。');
    });
  });
});
