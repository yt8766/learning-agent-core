import type {
  ExecutionNodeRecord,
  ExecutionPolicyDecision,
  ExecutionPolicyDecisionRecord,
  ExecutionRequestRecord,
  ExecutionRequestedBy,
  ExecutionResultError,
  ExecutionResultRecord,
  ExecutionResultStatus,
  ExecutionRiskClass
} from '@agent/core';

export interface ExecutionFabricFactoryOptions {
  now?: () => string;
  createId?: (prefix: string) => string;
}

export interface CreateExecutionRequestInput {
  taskId: string;
  sessionId?: string;
  nodeId: string;
  capabilityId?: string;
  toolName: string;
  requestedBy: ExecutionRequestedBy;
  inputPreview?: string;
  riskClass?: unknown;
  metadata?: Record<string, unknown>;
}

export interface CreateExecutionPolicyDecisionInput {
  requestId: string;
  decision: ExecutionPolicyDecision;
  reasonCode: string;
  reason: string;
  matchedPolicyIds?: string[];
  riskClass: ExecutionRiskClass;
  approvalScope?: string;
}

export interface CreateExecutionResultInput {
  requestId: string;
  taskId: string;
  nodeId: string;
  status: ExecutionResultStatus;
  outputPreview?: string;
  artifactIds?: string[];
  evidenceIds?: string[];
  error?: ExecutionResultError;
  startedAt?: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ListDefaultExecutionNodesOptions {
  now?: () => string;
}

export type {
  ExecutionNodeRecord,
  ExecutionPolicyDecisionRecord,
  ExecutionRequestRecord,
  ExecutionResultRecord,
  ExecutionRiskClass
};
