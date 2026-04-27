import type { AutoReviewResult } from '@agent/core';

export type AutoReviewRecord = AutoReviewResult;
export type AutoReviewApprovalAction = 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';

export interface AutoReviewListQuery {
  sessionId?: string;
  taskId?: string;
  requestId?: string;
  kind?: string;
  verdict?: string;
}

export interface AutoReviewApprovalRequest {
  sessionId: string;
  actor?: string;
  reason?: string;
  interrupt: {
    interruptId?: string;
    action: AutoReviewApprovalAction;
    reviewId: string;
    requestId?: string;
    approvalId?: string;
    feedback?: string;
    value?: string;
    payload?: {
      acceptedFindingIds?: string[];
      dismissedFindingIds?: string[];
      requiredFixSummary?: string;
      rerunAfterFix?: boolean;
      approvalScope?: 'once' | 'session' | 'always';
      reasonCode?: string;
      [key: string]: unknown;
    };
  };
}
