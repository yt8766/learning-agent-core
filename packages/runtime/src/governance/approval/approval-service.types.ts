import { ActionIntent } from '@agent/core';
import type { ToolDefinition } from '../../contracts/governance';

export type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

export interface ApprovalEvaluationInput {
  intent?: ActionIntentValue | string;
  executionMode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  profile?: string;
  command?: string;
  path?: string;
  fromPath?: string;
  toPath?: string;
  targetRoot?: string;
  url?: string;
  method?: string;
  target?: string;
  actionPrompt?: string;
  serverId?: string;
  capabilityId?: string;
}

export interface ApprovalEvaluationResult {
  requiresApproval: boolean;
  preflightDecision?: 'allow' | 'ask' | 'deny';
  reasonCode:
    | 'approved_by_policy'
    | 'requires_approval_destructive'
    | 'requires_approval_governance'
    | 'requires_approval_missing_preview'
    | 'requires_approval_profile_override'
    | 'requires_approval_tool_policy'
    | 'preflight_denied';
  reason: string;
}

export interface ApprovalClassifierInput {
  intent: ActionIntentValue;
  tool?: ToolDefinition;
  input?: ApprovalEvaluationInput;
}

export type ApprovalClassifier = (input: ApprovalClassifierInput) => Promise<
  | {
      decision: 'allow' | 'ask' | 'deny';
      reason: string;
    }
  | undefined
>;
