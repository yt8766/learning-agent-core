import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';

import { AutoReviewController } from '../../src/auto-review/auto-review.controller';

describe('AutoReviewController', () => {
  it('uses the route prefix that composes with the global api prefix once', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AutoReviewController)).toBe('auto-review');
  });

  it('exposes the REST facade paths documented by the Auto Review API', () => {
    expectRoute('createReview', RequestMethod.POST, 'reviews');
    expectRoute('listReviews', RequestMethod.GET, 'reviews');
    expectRoute('getReview', RequestMethod.GET, 'reviews/:reviewId');
    expectRoute('rerunReview', RequestMethod.POST, 'reviews/:reviewId/rerun');
    expectRoute('resumeApproval', RequestMethod.POST, 'reviews/:reviewId/approval');
  });

  it('delegates Auto Review facade routes to the service', () => {
    const service = {
      createReview: vi.fn(() => ({ reviewId: 'review-1' })),
      listReviews: vi.fn(() => [{ reviewId: 'review-1' }]),
      getReview: vi.fn(() => ({ reviewId: 'review-1' })),
      rerunReview: vi.fn(() => ({ reviewId: 'review-1', metadata: { rerunCount: 1 } })),
      resumeApproval: vi.fn(() => ({ reviewId: 'review-1', status: 'passed' }))
    };
    const controller = new AutoReviewController(service as never);
    const createBody = { taskId: 'task-1', kind: 'code_change', target: { type: 'diff' } };
    const query = {
      sessionId: 'session-1',
      taskId: 'task-1',
      requestId: 'request-1',
      kind: 'code_change',
      verdict: 'allow'
    };
    const rerunBody = { actor: 'human', reason: 'after fix' };
    const approvalBody = {
      sessionId: 'session-1',
      interrupt: { reviewId: 'review-1', action: 'approve' },
      actor: 'human'
    };

    expect(controller.createReview(createBody)).toEqual({ reviewId: 'review-1' });
    expect(controller.listReviews(query)).toEqual([{ reviewId: 'review-1' }]);
    expect(controller.getReview('review-1')).toEqual({ reviewId: 'review-1' });
    expect(controller.rerunReview('review-1', rerunBody)).toEqual({
      reviewId: 'review-1',
      metadata: { rerunCount: 1 }
    });
    expect(controller.resumeApproval('review-1', approvalBody)).toEqual({ reviewId: 'review-1', status: 'passed' });

    expect(service.createReview).toHaveBeenCalledWith(createBody);
    expect(service.listReviews).toHaveBeenCalledWith(query);
    expect(service.getReview).toHaveBeenCalledWith('review-1');
    expect(service.rerunReview).toHaveBeenCalledWith('review-1', rerunBody);
    expect(service.resumeApproval).toHaveBeenCalledWith('review-1', approvalBody);
  });
});

function expectRoute(methodName: keyof AutoReviewController, method: RequestMethod, path: string): void {
  const handler = AutoReviewController.prototype[methodName];
  expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
  expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
}
