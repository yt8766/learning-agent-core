import type {
  ActionIntent,
  ApprovalStatus,
  InteractionKind,
  RiskLevel,
  TrustClass,
  WorkerDomain,
  WorkflowApprovalPolicy
} from './primitives';
import type { CapabilityOwnerType } from './skills';

export type ToolCapabilityType = 'local-tool' | 'mcp-capability' | 'governance-tool';

export interface ToolFamilyRecord {
  id: string;
  displayName: string;
  description: string;
  capabilityType: ToolCapabilityType;
  ownerType: CapabilityOwnerType;
  ownerId?: string;
  bootstrap?: boolean;
  preferredMinistries?: WorkerDomain[];
  preferredSpecialists?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  family: string;
  category: 'knowledge' | 'system' | 'action' | 'memory';
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  timeoutMs: number;
  sandboxProfile: string;
  ownerType?: CapabilityOwnerType;
  ownerId?: string;
  bootstrap?: boolean;
  preferredMinistries?: WorkerDomain[];
  preferredSpecialists?: string[];
  capabilityType: ToolCapabilityType;
  inputSchema: Record<string, unknown>;
}

export interface ToolAttachmentRecord {
  toolName: string;
  family: string;
  ownerType: CapabilityOwnerType;
  ownerId?: string;
  attachedAt: string;
  attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
  preferred: boolean;
  reason?: string;
}

export interface ToolUsageSummaryRecord {
  toolName: string;
  family: string;
  capabilityType: ToolCapabilityType;
  status: 'selected' | 'called' | 'blocked' | 'approved' | 'completed' | 'failed';
  route: 'local' | 'mcp' | 'governance';
  requestedBy?: string;
  reason?: string;
  blockedReason?: string;
  serverId?: string;
  capabilityId?: string;
  approvalRequired?: boolean;
  riskLevel?: RiskLevel;
  usedAt: string;
}

export interface ToolExecutionRequest {
  taskId: string;
  toolName: string;
  intent: ActionIntent;
  input: Record<string, unknown>;
  requestedBy: 'agent' | 'user';
}

export interface ToolExecutionResult {
  ok: boolean;
  outputSummary: string;
  rawOutput?: unknown;
  exitCode?: number;
  errorMessage?: string;
  durationMs: number;
  serverId?: string;
  capabilityId?: string;
  transportUsed?: 'local-adapter' | 'stdio' | 'http';
  fallbackUsed?: boolean;
}

export interface ApprovalInterruptRecord {
  id: string;
  status: 'pending' | 'resolved' | 'cancelled';
  mode: 'blocking' | 'non-blocking';
  source: 'graph' | 'tool';
  kind: 'tool-approval' | 'skill-install' | 'connector-governance' | 'runtime-governance' | 'user-input';
  intent?: ActionIntent;
  toolName?: string;
  family?: string;
  capabilityType?: ToolCapabilityType;
  requestedBy?: string;
  ownerType?: CapabilityOwnerType;
  ownerId?: string;
  reason?: string;
  blockedReason?: string;
  riskLevel?: RiskLevel;
  threadId?: string;
  checkpointId?: string;
  resumeStrategy: 'command' | 'approval-recovery';
  preview?: Array<{
    label: string;
    value: string;
  }>;
  payload?: Record<string, unknown>;
  interactionKind?: InteractionKind;
  origin?: 'counselor_proxy' | 'runtime' | 'timeout' | 'budget' | 'review';
  proxySourceAgentId?: string;
  timeoutMinutes?: number;
  timeoutPolicy?: 'reject' | 'default-continue' | 'cancel-task';
  timedOutAt?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ApprovalResumeInput {
  interruptId?: string;
  action: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
  feedback?: string;
  value?: string;
  payload?: Record<string, unknown>;
}

export interface ApprovalRecord {
  taskId: string;
  intent: ActionIntent | string;
  actor?: string;
  reason?: string;
  decision: ApprovalStatus;
  decidedAt: string;
}

export interface McpCapability {
  id: string;
  toolName: string;
  serverId: string;
  displayName: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  category: ToolDefinition['category'];
  transport?: string;
  trustClass?: TrustClass;
  approvalPolicy?: WorkflowApprovalPolicy;
  healthState?: 'healthy' | 'degraded' | 'error' | 'unknown';
  argsSchema?: Record<string, unknown>;
  resultSchema?: Record<string, unknown>;
  isPrimaryForTool?: boolean;
  fallbackAvailable?: boolean;
  dataScope?: string;
  writeScope?: string;
}

export interface ConnectorHealthRecord {
  connectorId: string;
  healthState: 'healthy' | 'degraded' | 'error' | 'unknown' | 'disabled';
  reason?: string;
  checkedAt: string;
  transport?: string;
  implementedCapabilityCount?: number;
  discoveredCapabilityCount?: number;
}

export interface ApprovalPolicyRecord {
  id: string;
  scope: 'connector' | 'worker' | 'skill-source' | 'capability';
  targetId: string;
  mode: WorkflowApprovalPolicy | 'allow' | 'deny' | 'require-approval' | 'observe';
  reason: string;
  effect?: 'allow' | 'deny' | 'require-approval' | 'observe';
  connectorId?: string;
  workerId?: string;
  sourceId?: string;
  capabilityId?: string;
  matchedCount?: number;
}
