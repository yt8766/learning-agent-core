export type DashboardPageKey =
  | 'runtime'
  | 'approvals'
  | 'learning'
  | 'evals'
  | 'archives'
  | 'skills'
  | 'evidence'
  | 'connectors';

export interface ApprovalDecisionRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: string;
  sessionId?: string;
  runId?: string;
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
  result?: string;
  approvals: ApprovalDecisionRecord[];
  updatedAt: string;
  createdAt: string;
}

export interface TaskPlan {
  id: string;
  summary: string;
  steps: string[];
  subTasks: Array<{ id: string; title: string; description: string; assignedTo: string; status: string }>;
}

export interface AgentStateRecord {
  agentId: string;
  role: string;
  goal: string;
  subTask?: string;
  plan: string[];
  toolCalls: string[];
  observations: string[];
  shortTermMemory: string[];
  status: string;
  finalOutput?: string;
}

export interface AgentMessageRecord {
  id: string;
  from: string;
  to: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface ReviewRecord {
  taskId: string;
  decision: string;
  notes: string[];
}

export interface TraceRecord {
  node: string;
  at: string;
  summary: string;
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  action: string;
  status?: string;
  invalidationReason?: string;
  supersededById?: string;
  restoredAt?: string;
  createdAt?: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  status: string;
  description: string;
  version?: string;
  successRate?: number;
  promotionState?: string;
  sourceRuns?: string[];
  disabledReason?: string;
  restoredAt?: string;
  updatedAt?: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  currentMinistry?: string;
  currentWorker?: string;
  intent: string;
  reason?: string;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  taskGoal: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
  linkedRunId?: string;
  createdAt: string;
}

export interface ConnectorCapabilityRecord {
  id: string;
  displayName: string;
  toolName: string;
  category: string;
  riskLevel: string;
  requiresApproval: boolean;
}

export interface ConnectorRecord {
  id: string;
  displayName: string;
  transport: string;
  enabled: boolean;
  healthState: string;
  healthReason?: string;
  capabilityCount: number;
  implementedCapabilityCount?: number;
  discoveredCapabilityCount?: number;
  discoveredCapabilities?: string[];
  discoveryMode?: 'registered' | 'remote';
  sessionState?: 'stateless' | 'disconnected' | 'connected' | 'error';
  sessionCreatedAt?: string;
  sessionLastActivityAt?: string;
  sessionRequestCount?: number;
  sessionIdleMs?: number;
  lastDiscoveredAt?: string;
  lastDiscoveryError?: string;
  approvalRequiredCount: number;
  highRiskCount: number;
  capabilities: ConnectorCapabilityRecord[];
}

export interface SessionRecord {
  id: string;
  title: string;
  status: string;
  currentTaskId?: string;
  updatedAt: string;
}
