import { ApprovalDecision } from '@agent/core';

import type {
  ApprovalRecoveryGraphHandlers,
  ApprovalRecoveryGraphState
} from '../../graphs/approval/approval-recovery.graph';

export async function runExecuteApprovedNode(
  state: ApprovalRecoveryGraphState,
  handlers: ApprovalRecoveryGraphHandlers = {}
): Promise<ApprovalRecoveryGraphState> {
  return handlers.executeApproved
    ? handlers.executeApproved(state)
    : { ...state, approvalStatus: ApprovalDecision.APPROVED };
}

export async function runApprovalRecoveryFinishNode(
  state: ApprovalRecoveryGraphState,
  handlers: ApprovalRecoveryGraphHandlers = {}
): Promise<ApprovalRecoveryGraphState> {
  return handlers.finish ? handlers.finish(state) : state;
}
