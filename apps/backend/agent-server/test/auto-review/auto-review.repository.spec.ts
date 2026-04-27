import { describe, expect, it } from 'vitest';

import { AutoReviewRepository } from '../../src/auto-review/auto-review.repository';
import type { AutoReviewRecord } from '../../src/auto-review/auto-review.types';

describe('AutoReviewRepository', () => {
  it('restores auto-review records in snapshot order without leaking exported state', () => {
    const repository = new AutoReviewRepository();
    const firstReview = buildReview('review-snapshot-1', {
      findings: [
        {
          findingId: 'finding-1',
          severity: 'warning',
          category: 'rule_based_auto_review',
          title: 'Warning marker found',
          message: 'The review target contains a warning marker.',
          evidenceIds: ['finding-evidence-1']
        }
      ],
      evidenceIds: ['evidence-1'],
      artifactIds: ['artifact-1'],
      metadata: { nested: { source: 'auto-review' } }
    });
    const secondReview = buildReview('review-snapshot-2', {
      status: 'blocked',
      verdict: 'block',
      summary: 'Auto-review blocked this change.',
      metadata: { reason: 'blocker' }
    });

    repository.saveReview(firstReview);
    repository.saveReview(secondReview);
    const snapshot = repository.exportSnapshot();
    const restored = new AutoReviewRepository();
    restored.restoreSnapshot(snapshot);

    expect(Object.keys(snapshot)).toEqual(['reviews']);
    expect(restored.listReviews()).toEqual([firstReview, secondReview]);
    expect(restored.getReview(firstReview.reviewId)).toEqual(firstReview);

    snapshot.reviews.reverse();
    snapshot.reviews[1].findings[0]?.evidenceIds.push('mutated-finding-evidence');
    snapshot.reviews[1].metadata = { mutated: true };

    expect(repository.listReviews()).toEqual([firstReview, secondReview]);
    expect(restored.listReviews()).toEqual([firstReview, secondReview]);
  });

  it('parses restored auto-review snapshots before replacing current reviews', () => {
    const repository = new AutoReviewRepository();
    const existingReview = buildReview('review-existing');
    repository.saveReview(existingReview);

    expect(() =>
      repository.restoreSnapshot({
        reviews: [
          {
            ...buildReview('review-invalid'),
            status: 'not-a-status'
          } as unknown as AutoReviewRecord
        ]
      })
    ).toThrow();

    expect(repository.listReviews()).toEqual([existingReview]);
  });
});

function buildReview(reviewId: string, overrides: Partial<AutoReviewRecord> = {}): AutoReviewRecord {
  return {
    reviewId,
    sessionId: `session-${reviewId}`,
    taskId: `task-${reviewId}`,
    requestId: `request-${reviewId}`,
    kind: 'code_change',
    status: 'passed',
    verdict: 'allow',
    summary: 'Auto-review allowed this change.',
    findings: [],
    evidenceIds: [],
    artifactIds: [],
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    completedAt: '2026-04-26T00:00:00.000Z',
    metadata: {},
    ...overrides
  };
}
