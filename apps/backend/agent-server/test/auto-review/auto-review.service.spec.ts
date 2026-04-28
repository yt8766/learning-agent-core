import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AutoReviewResultSchema } from '@agent/tools';
import { describe, expect, it } from 'vitest';

import { AutoReviewRepository } from '../../src/auto-review/auto-review.repository';
import { AutoReviewService } from '../../src/auto-review/auto-review.service';

describe('AutoReviewService', () => {
  it('creates an allow review when the target preview has no rule findings', () => {
    const service = createService();

    const review = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'code_change',
      target: { type: 'diff', summary: 'small refactor', diffPreview: 'rename local variable' },
      evidenceIds: ['evidence-1'],
      artifactIds: ['artifact-1']
    });

    expect(review.status).toBe('passed');
    expect(review.verdict).toBe('allow');
    expect(review.findings).toEqual([]);
    expect(review.approval).toBeUndefined();
    expect(AutoReviewResultSchema.parse(review)).toEqual(review);
  });

  it('preserves correlation metadata without leaking vendor objects on create', () => {
    const service = createService();

    const review = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'sandbox_result',
      target: { type: 'sandbox', id: 'target-1', outputPreview: 'safe' },
      sandboxRunId: 'sandbox-run-1',
      metadata: {
        source: 'initial',
        vendorObject: { raw: true },
        vendorResponse: { raw: true },
        providerResponse: { id: 'provider-response-1' },
        rawProviderResponse: { id: 'raw-provider-response-1' }
      }
    });

    expect(review.metadata).toMatchObject({
      source: 'initial',
      requestId: 'request-1',
      sandboxRunId: 'sandbox-run-1'
    });
    expect(review.metadata).not.toHaveProperty('vendorObject');
    expect(review.metadata).not.toHaveProperty('vendorResponse');
    expect(review.metadata).not.toHaveProperty('providerResponse');
    expect(review.metadata).not.toHaveProperty('rawProviderResponse');
  });

  it('creates a warning review when the target preview contains warning markers', () => {
    const service = createService();

    const review = service.createReview({
      taskId: 'task-1',
      kind: 'tool_execution',
      target: { type: 'command', outputPreview: 'TODO: follow up on WARNING from lint' }
    });

    expect(review.status).toBe('warnings');
    expect(review.verdict).toBe('warn');
    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]).toMatchObject({ severity: 'warning', category: 'rule_based_auto_review' });
    expect(AutoReviewResultSchema.parse(review)).toEqual(review);
  });

  it('creates a blocked review and approval when the target preview contains blocker markers', () => {
    const service = createService();

    const review = service.createReview({
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'release',
      target: { type: 'release-plan', summary: 'DANGEROUS migration exposes SECRET token and BLOCKER remains' }
    });

    expect(review.status).toBe('blocked');
    expect(review.verdict).toBe('block');
    expect(review.findings[0]).toMatchObject({ severity: 'blocker', category: 'rule_based_auto_review' });
    expect(review.approval).toMatchObject({
      resumeEndpoint: '/api/auto-review/reviews/:reviewId/approval'
    });
    expect(AutoReviewResultSchema.parse(review)).toEqual(review);
  });

  it('keeps all rule gate findings when warning and blocker rules both match', () => {
    const service = createService();

    const review = service.createReview({
      taskId: 'task-1',
      kind: 'code_change',
      target: {
        type: 'diff',
        summary: 'WARNING: migration note',
        diffPreview: 'SECRET token remains in the preview'
      }
    });

    expect(review.status).toBe('blocked');
    expect(review.verdict).toBe('block');
    expect(review.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ severity: 'warning', category: 'rule_based_auto_review' }),
        expect.objectContaining({ severity: 'blocker', category: 'rule_based_auto_review' })
      ])
    );
    expect(review.findings).toHaveLength(2);
    expect(AutoReviewResultSchema.parse(review)).toEqual(review);
  });

  it('lists reviews with session, task, request, kind, and verdict filters', () => {
    const service = createService();
    const matching = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'code_change',
      target: { type: 'diff', summary: 'safe' }
    });
    service.createReview({
      sessionId: 'session-2',
      taskId: 'task-1',
      requestId: 'request-2',
      kind: 'release',
      target: { type: 'plan', summary: 'WARNING' }
    });

    expect(
      service.listReviews({
        sessionId: 'session-1',
        taskId: 'task-1',
        requestId: 'request-1',
        kind: 'code_change',
        verdict: 'allow'
      })
    ).toEqual([matching]);
  });

  it('throws not found for an unknown review', () => {
    const service = createService();

    expect(() => service.getReview('missing-review')).toThrow(NotFoundException);
    expect(() => service.getReview('missing-review')).toThrow('auto_review_not_found');
  });

  it('rejects empty route and body ids using auto_review_request_invalid', () => {
    const service = createService();

    expectInvalidAutoReviewRequest(() => service.getReview(''));
    expectInvalidAutoReviewRequest(() => service.rerunReview('', {}));
    expectInvalidAutoReviewRequest(() =>
      service.resumeApproval('', {
        sessionId: 'session-empty-route',
        interrupt: { reviewId: 'review-1', action: 'approve' }
      })
    );
    expectInvalidAutoReviewRequest(() =>
      service.createReview({
        sessionId: '',
        taskId: 'task-empty-session',
        kind: 'code_change',
        target: { type: 'diff' }
      })
    );
    expectInvalidAutoReviewRequest(() =>
      service.createReview({
        taskId: '',
        kind: 'code_change',
        target: { type: 'diff' }
      })
    );
    expectInvalidAutoReviewRequest(() =>
      service.resumeApproval('review-1', {
        sessionId: '',
        interrupt: { reviewId: 'review-1', action: 'approve' }
      })
    );
    expectInvalidAutoReviewRequest(() =>
      service.resumeApproval('review-1', {
        sessionId: 'session-1',
        interrupt: { reviewId: '', action: 'approve' }
      })
    );
  });

  it('reruns a review by preserving associations and incrementing metadata', () => {
    const service = createService();
    const original = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'sandbox_result',
      target: { type: 'sandbox', outputPreview: 'WARNING: retryable issue' },
      sandboxRunId: 'sandbox-run-1',
      evidenceIds: ['evidence-1'],
      metadata: { source: 'initial' }
    });

    const rerun = service.rerunReview(original.reviewId, { actor: 'human', reason: 'after fix' });

    expect(rerun.reviewId).toBe(original.reviewId);
    expect(rerun.sessionId).toBe('session-1');
    expect(rerun.taskId).toBe('task-1');
    expect(rerun.requestId).toBe('request-1');
    expect(rerun.evidenceIds).toEqual(['evidence-1']);
    expect(rerun.metadata).toMatchObject({
      source: 'initial',
      requestId: 'request-1',
      sandboxRunId: 'sandbox-run-1',
      rerunCount: 1,
      lastRerunBy: 'human',
      lastRerunReason: 'after fix'
    });
    expect(rerun.completedAt).toBeDefined();
    expect(new Date(rerun.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(original.updatedAt).getTime());
    expect(AutoReviewResultSchema.parse(rerun)).toEqual(rerun);
  });

  it('approves blocked reviews into warnings and rejects them into cancelled', () => {
    const service = createService();
    const blocked = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      kind: 'policy',
      target: { type: 'policy', summary: 'BLOCKER' }
    });

    const approved = service.resumeApproval(blocked.reviewId, {
      sessionId: 'session-1',
      interrupt: {
        reviewId: blocked.reviewId,
        action: 'approve',
        payload: { acceptedFindingIds: [blocked.findings[0]?.findingId ?? 'finding-1'] }
      },
      actor: 'human',
      reason: 'accepted risk'
    });

    expect(approved.status).toBe('warnings');
    expect(approved.verdict).toBe('warn');
    expect(approved.metadata).toMatchObject({
      approvalAction: 'approve',
      approvalActor: 'human',
      approvalReason: 'accepted risk'
    });

    const blockedAgain = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-2',
      kind: 'policy',
      target: { type: 'policy', summary: 'SECRET' }
    });
    const rejected = service.resumeApproval(blockedAgain.reviewId, {
      sessionId: 'session-1',
      interrupt: { reviewId: blockedAgain.reviewId, action: 'reject' },
      actor: 'human'
    });

    expect(rejected.status).toBe('cancelled');
    expect(rejected.verdict).toBe('unknown');
    expect(rejected.metadata).toMatchObject({ approvalAction: 'reject' });
  });

  it('preserves correlation metadata when resuming reviews restored without metadata associations', () => {
    const repository = new AutoReviewRepository();
    const service = new AutoReviewService(repository);
    const blocked = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'sandbox_result',
      sandboxRunId: 'sandbox-run-1',
      target: { type: 'sandbox', summary: 'BLOCKER' }
    });
    repository.saveReview({ ...blocked, metadata: {} });

    const approved = service.resumeApproval(blocked.reviewId, {
      sessionId: 'session-1',
      interrupt: {
        reviewId: blocked.reviewId,
        action: 'approve',
        approvalId: blocked.approval?.approvalId
      },
      actor: 'human'
    });

    expect(approved.metadata).toMatchObject({
      requestId: 'request-1',
      sandboxRunId: 'sandbox-run-1',
      approvalAction: 'approve'
    });
  });

  it('rejects approval resume route and approval id mismatches with auto_review_request_invalid', () => {
    const service = createService();
    const blocked = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      kind: 'policy',
      target: { type: 'policy', summary: 'BLOCKER' }
    });

    expectInvalidAutoReviewRequest(() =>
      service.resumeApproval(blocked.reviewId, {
        sessionId: 'session-1',
        interrupt: {
          reviewId: 'different-review',
          action: 'approve',
          approvalId: blocked.approval?.approvalId
        }
      })
    );
    expectInvalidAutoReviewRequest(() =>
      service.resumeApproval(blocked.reviewId, {
        sessionId: 'session-1',
        interrupt: {
          reviewId: blocked.reviewId,
          action: 'approve',
          approvalId: 'approval_review_different'
        }
      })
    );
  });

  it('keeps feedback/input approvals blocked and rejects approval for non-blocked reviews', () => {
    const service = createService();
    const blocked = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-1',
      kind: 'code_change',
      target: { type: 'diff', summary: 'DANGEROUS' }
    });

    const feedback = service.resumeApproval(blocked.reviewId, {
      sessionId: 'session-1',
      interrupt: {
        reviewId: blocked.reviewId,
        action: 'feedback',
        feedback: 'please remove shell escape',
        payload: { requiredFixSummary: 'remove shell escape' }
      },
      actor: 'human'
    });

    expect(feedback.status).toBe('blocked');
    expect(feedback.verdict).toBe('block');
    expect(feedback.metadata).toMatchObject({
      approvalAction: 'feedback',
      feedback: 'please remove shell escape',
      requiredFixSummary: 'remove shell escape'
    });

    const allowed = service.createReview({
      sessionId: 'session-1',
      taskId: 'task-2',
      kind: 'code_change',
      target: { type: 'diff', summary: 'safe' }
    });

    expect(() =>
      service.resumeApproval(allowed.reviewId, {
        sessionId: 'session-1',
        interrupt: { reviewId: allowed.reviewId, action: 'approve' }
      })
    ).toThrow(ConflictException);
    expect(() =>
      service.resumeApproval(allowed.reviewId, {
        sessionId: 'session-1',
        interrupt: { reviewId: allowed.reviewId, action: 'approve' }
      })
    ).toThrow('auto_review_conflict');
  });
});

function createService(): AutoReviewService {
  return new AutoReviewService(new AutoReviewRepository());
}

function expectInvalidAutoReviewRequest(action: () => unknown): void {
  try {
    action();
    throw new Error('expected invalid auto review request');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'auto_review_request_invalid' })
    );
  }
}
