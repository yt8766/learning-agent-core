import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import { ApprovalDecision, ToolExecutionResult } from '@agent/core';

import {
  runApprovalRecoveryFinishNode,
  runExecuteApprovedNode
} from '../../flows/approval/approval-recovery-graph-nodes';
import { PendingExecutionContext } from '../../flows/approval';

type ApprovalDecisionValue = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export interface ApprovalRecoveryGraphState {
  taskId: string;
  goal: string;
  pending: PendingExecutionContext;
  executionResult?: ToolExecutionResult;
  executionSummary?: string;
  approvalStatus?: ApprovalDecisionValue;
}

export interface ApprovalRecoveryGraphHandlers {
  executeApproved?: (state: ApprovalRecoveryGraphState) => Promise<ApprovalRecoveryGraphState>;
  finish?: (state: ApprovalRecoveryGraphState) => Promise<ApprovalRecoveryGraphState>;
}

const RecoveryAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  pending: Annotation<PendingExecutionContext>(),
  executionResult: Annotation<ToolExecutionResult | undefined>(),
  executionSummary: Annotation<string | undefined>(),
  approvalStatus: Annotation<ApprovalDecisionValue | undefined>()
});

export function createApprovalRecoveryGraph(handlers: ApprovalRecoveryGraphHandlers = {}) {
  return new StateGraph(RecoveryAnnotation)
    .addNode('execute_approved', state => runExecuteApprovedNode(state, handlers))
    .addNode('finish', state => runApprovalRecoveryFinishNode(state, handlers))
    .addEdge(START, 'execute_approved')
    .addEdge('execute_approved', 'finish')
    .addEdge('finish', END);
}
