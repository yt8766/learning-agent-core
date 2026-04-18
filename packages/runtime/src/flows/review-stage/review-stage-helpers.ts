import type { ReviewRecord } from '@agent/core';
import type { RuntimeTaskRecord } from '../../runtime/runtime-task.types';

export function deriveFinalReviewDecision(task: RuntimeTaskRecord, review: ReviewRecord, shouldRetry: boolean) {
  if (review.decision === 'blocked') {
    return 'block' as const;
  }
  if (shouldRetry) {
    return 'revise_required' as const;
  }
  if (task.pendingApproval) {
    return 'needs_human_approval' as const;
  }
  return 'pass' as const;
}

export function buildFinalReviewSummary(
  task: RuntimeTaskRecord,
  summary?: string,
  critiqueDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval'
) {
  if (summary) {
    return summary;
  }

  switch (critiqueDecision) {
    case 'revise_required':
      return '刑部认为当前草稿仍需修订。';
    case 'block':
      return '刑部判定当前方案存在阻断问题。';
    case 'needs_human_approval':
      return '刑部认为当前动作需要人工审批后才能继续。';
    default:
      return '刑部审查通过。';
  }
}
