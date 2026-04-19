import type { RuntimeCenterTaskLike } from './runtime-center-projection.types';

export function toCritiqueStyleReviewOutcome(
  reviewOutcome: NonNullable<NonNullable<RuntimeCenterTaskLike['governanceReport']>['reviewOutcome']>
) {
  return {
    ...reviewOutcome,
    decision:
      reviewOutcome.decision === 'blocked'
        ? 'block'
        : reviewOutcome.decision === 'approved' || reviewOutcome.decision === 'retry'
          ? 'pass'
          : reviewOutcome.decision
  };
}
