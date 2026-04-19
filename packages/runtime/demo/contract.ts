import {
  buildRuntimeCenterProjection,
  buildRuntimeCenterSummaryProjection,
  toCritiqueStyleReviewOutcome
} from '../src/index.js';
import * as runtimeCenterProjectionExports from '../src/runtime/runtime-center-projection.js';

console.log(
  JSON.stringify(
    {
      projectionAligned: buildRuntimeCenterProjection === runtimeCenterProjectionExports.buildRuntimeCenterProjection,
      summaryAligned:
        buildRuntimeCenterSummaryProjection === runtimeCenterProjectionExports.buildRuntimeCenterSummaryProjection,
      critiqueAdapterAligned:
        toCritiqueStyleReviewOutcome === runtimeCenterProjectionExports.toCritiqueStyleReviewOutcome,
      legacyBlockedDecision: toCritiqueStyleReviewOutcome({ decision: 'blocked', summary: 'blocked' }).decision,
      legacyApprovedDecision: toCritiqueStyleReviewOutcome({ decision: 'approved', summary: 'approved' }).decision
    },
    null,
    2
  )
);
