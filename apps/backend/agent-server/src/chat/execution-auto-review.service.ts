import { Injectable } from '@nestjs/common';
import { ExecutionAutoReviewRecordSchema, type ExecutionAutoReviewRecord } from '@agent/core';

import { reviewExecutionAction, type ExecutionReviewInput } from './execution-auto-review.rules';

@Injectable()
export class ExecutionAutoReviewService {
  review(input: ExecutionReviewInput): ExecutionAutoReviewRecord {
    const decision = reviewExecutionAction(input);
    return ExecutionAutoReviewRecordSchema.parse({
      id: `exec_review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: input.sessionId,
      runId: input.runId,
      requestId: input.requestId,
      subject: input.proposedAction.subject,
      ...decision,
      userFacingSummary: buildUserFacingSummary(decision),
      createdAt: new Date().toISOString()
    });
  }
}

function buildUserFacingSummary(
  decision: Pick<ExecutionAutoReviewRecord, 'verdict' | 'riskLevel' | 'reasons'>
): string {
  if (decision.verdict === 'allow') {
    return `自动审查通过：${decision.riskLevel} 风险，${decision.reasons.join('；')}`;
  }
  if (decision.verdict === 'needs_confirmation') {
    return `自动审查要求确认：${decision.riskLevel} 风险，${decision.reasons.join('；')}`;
  }
  return `自动审查阻断：${decision.reasons.join('；')}`;
}
