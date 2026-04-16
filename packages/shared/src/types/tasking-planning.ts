export {
  EntryDecisionRecordSchema,
  ExecutionPlanRecordSchema,
  PartialAggregationRecordSchema,
  PlanDecisionRecordSchema,
  PlanDraftRecordSchema,
  PlanModeTransitionRecordSchema,
  PlanQuestionOptionRecordSchema,
  PlanQuestionRecordSchema
} from '@agent/core';
export type {
  PlanDecisionRecord,
  PlanDraftRecord,
  PlanModeTransitionRecord,
  PlanQuestionOptionRecord,
  PlanQuestionRecord
} from '@agent/core';

import type { ExecutionPlanMode, MainChainNode, SpecialistDomain, WorkerDomain } from './primitives';

export interface EntryDecisionRecord {
  requestedMode: ExecutionPlanMode;
  counselorSelector?: {
    strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
    key?: string;
    candidateIds?: string[];
    weights?: number[];
    selectedCounselorId?: string;
    selectedVersion?: string;
    featureFlag?: string;
  };
  selectionReason?: string;
  defaultCounselorId?: string;
  imperialDirectIntent?: {
    enabled: boolean;
    trigger: 'slash-exec' | 'explicit-direct-execution' | 'known-capability';
    requestedCapability?: string;
    reason?: string;
  };
}

export interface ExecutionPlanRecord {
  mode: ExecutionPlanMode;
  tokenBudget?: number;
  costBudget?: number;
  softBudgetThreshold?: number;
  hardBudgetThreshold?: number;
  modeCapabilities?: string[];
  dispatchChain?: MainChainNode[];
  filteredCapabilities?: string[];
  strategyCounselors?: SpecialistDomain[];
  executionMinistries?: WorkerDomain[];
  selectedCounselorId?: string;
  selectedVersion?: string;
  partialAggregationPolicy?: {
    allowedOutputKinds: Array<'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress'>;
    requiresInterruptApprovalForProgress: boolean;
  };
}

export interface PartialAggregationRecord {
  kind: 'preview' | 'low_risk_action_suggestion' | 'approved_lightweight_progress';
  summary: string;
  recommendedNextStep?: string;
  requiresApproval: boolean;
  allowedCapabilities: string[];
  sourceCounselorIds?: string[];
  createdAt: string;
}

export interface CounselorSelectorConfig {
  selectorId: string;
  domain: string;
  enabled: boolean;
  strategy: 'user-id' | 'session-ratio' | 'task-type' | 'feature-flag' | 'manual';
  candidateIds: string[];
  weights?: number[];
  featureFlag?: string;
  defaultCounselorId: string;
  createdAt: string;
  updatedAt: string;
}

export type PlanMode = 'intent' | 'implementation' | 'finalized' | 'aborted';
export type PlanQuestionType = 'direction' | 'detail' | 'tradeoff';
export type PlanDecisionResolutionSource =
  | 'user-answer'
  | 'default-assumption'
  | 'auto-resolved'
  | 'bypass-recommended'
  | 'fallback-assumption';
