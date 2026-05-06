export type AgentToolProjectedEventKind =
  | 'tool_selected'
  | 'tool_called'
  | 'tool_stream'
  | 'execution_step'
  | 'interrupt';

export type AgentToolProjectedEventStatus =
  | 'pending'
  | 'pending_policy'
  | 'pending_approval'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'resumed'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'denied';

export interface AgentToolProjectedApproval {
  approvalId?: string;
  interruptId?: string;
  required: boolean;
}

export interface AgentToolProjectedEvent {
  requestId: string;
  kind: AgentToolProjectedEventKind;
  status: AgentToolProjectedEventStatus;
  title: string;
  summary?: string;
  toolName?: string;
  capabilityId?: string;
  nodeId?: string;
  riskClass?: string;
  approval?: AgentToolProjectedApproval;
  action?: string;
  reasonCode?: string;
  resultId?: string;
  streamKind?: string;
  policyDecision?: AgentToolProjectedPolicyDecision;
}

export interface AgentToolProjectedPolicyDecision {
  decisionId?: string;
  decision?: string;
  reasonCode?: string;
  reason?: string;
  requiresApproval?: boolean;
  riskClass?: string;
}

export interface AgentToolEventLike {
  id?: unknown;
  sessionId?: unknown;
  type?: unknown;
  event?: unknown;
  at?: unknown;
  payload?: unknown;
}

export interface AgentToolGovernanceProjectionLike {
  requests?: readonly AgentToolRequestProjectionLike[];
  results?: readonly AgentToolResultProjectionLike[];
  policyDecisions?: readonly AgentToolPolicyDecisionProjectionLike[];
  events?: readonly AgentToolEventLike[];
}

export interface AgentToolRequestProjectionLike {
  requestId?: unknown;
  nodeId?: unknown;
  capabilityId?: unknown;
  toolName?: unknown;
  inputPreview?: unknown;
  riskClass?: unknown;
  status?: unknown;
}

export interface AgentToolResultProjectionLike {
  resultId?: unknown;
  requestId?: unknown;
  nodeId?: unknown;
  status?: unknown;
  outputPreview?: unknown;
}

export interface AgentToolPolicyDecisionProjectionLike {
  decisionId?: unknown;
  requestId?: unknown;
  decision?: unknown;
  reasonCode?: unknown;
  reason?: unknown;
  requiresApproval?: unknown;
  riskClass?: unknown;
}
