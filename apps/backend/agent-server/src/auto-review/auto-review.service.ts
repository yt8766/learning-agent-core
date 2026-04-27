import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AutoReviewResultSchema } from '@agent/core';

import { AutoReviewRepository } from './auto-review.repository';
import { runRuleBasedReviewGate } from './auto-review.rules';
import {
  AutoReviewApprovalResumeRequestSchema,
  CreateAutoReviewRequestSchema,
  RerunAutoReviewRequestSchema
} from './auto-review.schemas';
import type { AutoReviewListQuery, AutoReviewRecord } from './auto-review.types';

@Injectable()
export class AutoReviewService {
  constructor(private readonly repository: AutoReviewRepository) {}

  createReview(body: unknown): AutoReviewRecord {
    const input = parseOrThrow(CreateAutoReviewRequestSchema, body, 'auto_review_request_invalid');
    const now = new Date().toISOString();
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ruleGateReview = runRuleBasedReviewGate(
      input.target.type,
      [input.target.summary, input.target.diffPreview, input.target.outputPreview].filter(Boolean).join('\n')
    );
    const review = AutoReviewResultSchema.parse({
      reviewId,
      sessionId: input.sessionId,
      taskId: input.taskId,
      requestId: input.requestId,
      kind: input.kind,
      status: ruleGateReview.status,
      verdict: ruleGateReview.verdict,
      summary: buildSummary(ruleGateReview.verdict),
      findings: ruleGateReview.findings,
      evidenceIds: input.evidenceIds,
      artifactIds: input.artifactIds,
      sandboxRunId: input.sandboxRunId,
      policyDecisionId: input.policyDecisionId,
      approval: ruleGateReview.verdict === 'block' ? buildApproval() : undefined,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      metadata: buildMetadata(input.metadata, {
        requestId: input.requestId,
        sandboxRunId: input.sandboxRunId,
        target: input.target,
        requestedBy: input.requestedBy
      })
    });
    return this.repository.saveReview(review);
  }

  listReviews(query: AutoReviewListQuery = {}): AutoReviewRecord[] {
    return this.repository
      .listReviews()
      .filter(
        review =>
          optionalEquals(review.sessionId, query.sessionId) &&
          optionalEquals(review.taskId, query.taskId) &&
          optionalEquals(review.requestId, query.requestId) &&
          optionalEquals(review.kind, query.kind) &&
          optionalEquals(review.verdict, query.verdict)
      );
  }

  getReview(reviewId: string): AutoReviewRecord {
    assertNonEmptyId(reviewId);
    const review = this.repository.getReview(reviewId);
    if (!review) {
      throw new NotFoundException({
        code: 'auto_review_not_found',
        message: `auto_review_not_found: Auto review ${reviewId} not found`,
        reviewId
      });
    }
    return review;
  }

  rerunReview(reviewId: string, body: unknown): AutoReviewRecord {
    assertNonEmptyId(reviewId);
    const input = parseOrThrow(RerunAutoReviewRequestSchema, body, 'auto_review_request_invalid');
    const review = this.getReview(reviewId);
    const now = new Date().toISOString();
    const rerunCount = typeof review.metadata.rerunCount === 'number' ? review.metadata.rerunCount + 1 : 1;
    return this.repository.saveReview({
      ...review,
      updatedAt: now,
      completedAt: now,
      evidenceIds: input.includeEvidenceIds ?? review.evidenceIds,
      metadata: {
        ...review.metadata,
        requestId: review.requestId,
        sandboxRunId: review.sandboxRunId,
        rerunOf: review.reviewId,
        rerunCount,
        lastRerunBy: input.actor,
        lastRerunReason: input.reason
      }
    });
  }

  resumeApproval(reviewId: string, body: unknown): AutoReviewRecord {
    assertNonEmptyId(reviewId);
    const input = parseOrThrow(AutoReviewApprovalResumeRequestSchema, body, 'auto_review_request_invalid');
    const review = this.getReview(reviewId);
    if (input.interrupt.reviewId !== reviewId) {
      throw new BadRequestException({
        code: 'auto_review_request_invalid',
        message: 'Approval reviewId must match the route reviewId',
        reviewId
      });
    }
    if (input.interrupt.approvalId && input.interrupt.approvalId !== review.approval?.approvalId) {
      throw new BadRequestException({
        code: 'auto_review_request_invalid',
        message: 'Approval id does not match the auto review',
        reviewId
      });
    }
    if (review.status !== 'blocked') {
      throw new ConflictException({
        code: 'auto_review_conflict',
        message: `auto_review_conflict: Auto review ${reviewId} is not blocked`,
        reviewId,
        status: review.status
      });
    }

    const now = new Date().toISOString();
    const metadata = buildMetadata(review.metadata, {
      requestId: review.requestId,
      sandboxRunId: review.sandboxRunId,
      approvalAction: input.interrupt.action,
      approvalActor: input.actor,
      approvalReason: input.reason,
      feedback: input.interrupt.feedback,
      requiredFixSummary: input.interrupt.payload?.requiredFixSummary,
      approvalPayload: input.interrupt.payload
    });

    if (input.interrupt.action === 'approve' || input.interrupt.action === 'bypass') {
      return this.repository.saveReview({
        ...review,
        status: 'warnings',
        verdict: 'warn',
        approval: undefined,
        updatedAt: now,
        metadata
      });
    }

    if (input.interrupt.action === 'reject' || input.interrupt.action === 'abort') {
      return this.repository.saveReview({
        ...review,
        status: 'cancelled',
        verdict: 'unknown',
        approval: undefined,
        updatedAt: now,
        metadata
      });
    }

    return this.repository.saveReview({
      ...review,
      status: 'blocked',
      verdict: 'block',
      updatedAt: now,
      metadata
    });
  }
}

function buildSummary(verdict: 'allow' | 'warn' | 'block'): string {
  if (verdict === 'block') {
    return 'Auto review blocked this target pending approval or fixes.';
  }
  if (verdict === 'warn') {
    return 'Auto review completed with warnings.';
  }
  return 'Auto review passed.';
}

function buildApproval() {
  return {
    approvalId: `approval_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    interruptId: `interrupt_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    resumeEndpoint: '/api/auto-review/reviews/:reviewId/approval' as const
  };
}

function optionalEquals<T>(actual: T | undefined, expected: T | undefined): boolean {
  return expected === undefined || actual === expected;
}

function buildMetadata(
  metadata: Record<string, unknown>,
  correlations: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = Object.fromEntries(Object.entries(metadata).filter(([key]) => !isVendorObjectMetadataKey(key)));
  return Object.fromEntries(
    Object.entries({
      ...sanitized,
      ...correlations
    }).filter(([, value]) => value !== undefined)
  );
}

function isVendorObjectMetadataKey(key: string): boolean {
  return ['vendorObject', 'vendorResponse', 'rawVendorResponse', 'providerResponse', 'rawProviderResponse'].includes(
    key
  );
}

function assertNonEmptyId(reviewId: string): void {
  if (reviewId.length === 0) {
    throw new BadRequestException({
      code: 'auto_review_request_invalid',
      message: 'Auto review id must not be empty'
    });
  }
}

function parseOrThrow<T>(schema: { parse: (value: unknown) => T }, body: unknown, code: string): T {
  try {
    return schema.parse(body);
  } catch (error) {
    throw new BadRequestException({
      code,
      message: 'Invalid auto review request body',
      issues: error instanceof Error ? error.message : String(error)
    });
  }
}
