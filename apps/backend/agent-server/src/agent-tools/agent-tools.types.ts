import type {
  ChatEventRecord,
  ExecutionCapabilityRecord,
  ExecutionNodeRecord,
  ExecutionPolicyDecisionRecord,
  ExecutionRequestRecord,
  ExecutionResultRecord
} from '@agent/core';

import type { AgentToolApprovalResumeInput, AgentToolEventsQuery } from './agent-tools.schemas';

export interface AgentToolApprovalProjection {
  approvalId: string;
  interruptId: string;
  resumeEndpoint: string;
  resumePayload: AgentToolApprovalResumeInput;
}

export interface AgentToolExecutionResponse {
  request: ExecutionRequestRecord;
  policyDecision?: ExecutionPolicyDecisionRecord;
  result?: ExecutionResultRecord;
  approval?: AgentToolApprovalProjection;
}

export interface AgentToolGovernanceProjection {
  requests: ExecutionRequestRecord[];
  results: ExecutionResultRecord[];
  capabilities: ExecutionCapabilityRecord[];
  nodes: ExecutionNodeRecord[];
  policyDecisions: ExecutionPolicyDecisionRecord[];
  events: ChatEventRecord[];
}

export interface AgentToolProjectionQuery {
  requestId?: string;
  taskId?: string;
  sessionId?: string;
}

export type { AgentToolEventsQuery };

export interface AgentToolStoredRequest {
  request: ExecutionRequestRecord;
  result?: ExecutionResultRecord;
  approval?: AgentToolApprovalProjection;
}

export interface AgentToolApprovalSnapshot {
  requestId: string;
  approval: AgentToolApprovalProjection;
}

export interface AgentToolsRepositorySnapshot {
  requests: ExecutionRequestRecord[];
  results: ExecutionResultRecord[];
  events: ChatEventRecord[];
  approvals: AgentToolApprovalSnapshot[];
}

export interface AgentToolsRepositoryStore {
  exportSnapshot(): AgentToolsRepositorySnapshot;
  restoreSnapshot(snapshot: AgentToolsRepositorySnapshot): void;
}

export interface AgentToolNodeQuery {
  status?: string;
  kind?: string;
  sandboxMode?: string;
  riskClass?: string;
}

export interface AgentToolCapabilityQuery {
  nodeId?: string;
  category?: string;
  riskClass?: string;
  requiresApproval?: boolean | string;
}

export interface AgentToolCatalog {
  nodes: ExecutionNodeRecord[];
  capabilities: ExecutionCapabilityRecord[];
}
