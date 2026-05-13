import type { ApprovalDecisionRecord, EvidenceRecord as CoreEvidenceRecord } from '@agent/core';
import type { AdminTaskAggregate } from './tasking-task.types';

export type DashboardPageKey =
  | 'runtime'
  | 'approvals'
  | 'learning'
  | 'workspace'
  | 'evals'
  | 'archives'
  | 'skills'
  | 'evidence'
  | 'connectors'
  | 'skillSources'
  | 'companyAgents'
  | 'intelligence'
  | 'knowledgeGovernance'
  | 'memory'
  | 'profiles'
  | 'workflowLab';

export interface SpecialistLeadRecord {
  id: string;
  displayName: string;
  domain: string;
  reason: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface SpecialistSupportRecord {
  id: string;
  displayName: string;
  domain: string;
  reason?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface PlannerStrategyRecord {
  mode: 'default' | 'capability-gap' | 'rich-candidates';
  summary: string;
  leadDomain?: string;
  requiredCapabilities?: string[];
  preferredAgentId?: string;
  candidateAgentIds?: string[];
  candidateCount: number;
  gapDetected: boolean;
  updatedAt: string;
}

export interface CritiqueResultRecord {
  contractVersion?: 'critique-result.v1';
  decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
  summary: string;
  blockingIssues?: string[];
  constraints?: string[];
  evidenceRefs?: string[];
  shouldBlockEarly?: boolean;
}

export interface SpecialistFindingRecord {
  specialistId: string;
  role: 'lead' | 'support';
  contractVersion: 'specialist-finding.v1';
  source: 'route' | 'research' | 'execution' | 'critique';
  stage: 'planning' | 'research' | 'execution' | 'review';
  domain: string;
  summary: string;
  riskLevel?: string;
  blockingIssues?: string[];
  constraints?: string[];
  suggestions?: string[];
  evidenceRefs?: string[];
  confidence?: number;
}

export type ExecutionStepRoute = 'direct-reply' | 'research-first' | 'workflow-execute' | 'approval-recovery';
export type ExecutionStepStage =
  | 'request-received'
  | 'route-selection'
  | 'task-planning'
  | 'research'
  | 'execution'
  | 'review'
  | 'delivery'
  | 'approval-interrupt'
  | 'recovery';
export type ExecutionStepStatus = 'pending' | 'running' | 'completed' | 'blocked';
export type ExecutionStepOwner = 'session' | 'libu' | 'hubu' | 'gongbu' | 'bingbu' | 'xingbu' | 'libu-docs' | 'system';

export interface ExecutionStepRecord {
  id: string;
  route: ExecutionStepRoute;
  stage: ExecutionStepStage;
  label: string;
  owner: ExecutionStepOwner;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  detail?: string;
  reason?: string;
}

export type TaskRecord = Omit<
  AdminTaskAggregate,
  | 'status'
  | 'currentMinistry'
  | 'approvals'
  | 'resolvedWorkflow'
  | 'critiqueResult'
  | 'trace'
  | 'agentStates'
  | 'messages'
> & {
  status: string;
  currentMinistry?: string;
  approvals: ApprovalDecisionRecord[];
  trace?: AdminTaskAggregate['trace'];
  agentStates?: AdminTaskAggregate['agentStates'];
  messages?: AdminTaskAggregate['messages'];
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    version?: string;
  };
  critiqueResult?: CritiqueResultRecord;
  streamStatus?: {
    nodeId?: string;
    nodeLabel?: string;
    detail?: string;
    progressPercent?: number;
    updatedAt: string;
  };
  plannerStrategy?: PlannerStrategyRecord;
};

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
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  specialistId?: string;
  role?: 'lead' | 'support' | 'ministry';
  latencyMs?: number;
  status?: string;
  revisionCount?: number;
  modelUsed?: string;
  isFallback?: boolean;
  fallbackReason?: string;
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
  audit?: {
    taskId: string;
    entries: Array<{
      id: string;
      at: string;
      type: 'trace' | 'approval' | 'governance' | 'usage';
      title: string;
      summary: string;
      detail?: unknown;
      outcome?: string;
    }>;
    browserReplays: Array<{
      sessionId?: string;
      url?: string;
      artifactRef?: string;
      snapshotRef?: string;
      screenshotRef?: string;
      stepCount: number;
    }>;
    traceSummary?: {
      criticalPaths: Array<{
        pathLabel: string;
        totalLatencyMs: number;
        spanCount: number;
        fallbackNodes: string[];
        reviseNodes: string[];
      }>;
      fallbackSpans: string[];
      reviseSpans: string[];
      roleLatencyBreakdown: Array<{
        role: string;
        totalLatencyMs: number;
        spanCount: number;
      }>;
      slowestSpan?: {
        node: string;
        latencyMs: number;
      };
    };
  };
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
  sourceId?: string;
  installReceiptId?: string;
  requiredCapabilities?: string[];
  requiredConnectors?: string[];
  version?: string;
  successRate?: number;
  promotionState?: string;
  governanceRecommendation?: string;
  sourceRuns?: string[];
  allowedTools?: string[];
  compatibility?: string;
  disabledReason?: string;
  restoredAt?: string;
  updatedAt?: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  // Derived approval items should prefer canonical values, but legacy aliases remain readable for compatibility.
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  currentMinistry?: string;
  currentWorker?: string;
  intent: string;
  interactionKind?:
    | 'approval'
    | 'plan-question'
    | 'supplemental-input'
    | 'revise-required'
    | 'micro-loop-exhausted'
    | 'mode-transition';
  questionSetTitle?: string;
  reason?: string;
  reasonCode?: string;
  toolName?: string;
  riskLevel?: string;
  requestedBy?: string;
  interruptSource?: 'graph' | 'tool';
  interruptMode?: 'blocking' | 'non-blocking';
  resumeStrategy?: 'command' | 'approval-recovery';
  commandPreview?: string;
  riskReason?: string;
  riskCode?: string;
  approvalScope?: 'once' | 'session' | 'always' | string;
  policyMatchStatus?: string;
  policyMatchSource?: string;
  lastStreamStatusAt?: string;
  preview?: Array<{
    label: string;
    value: string;
  }>;
}

export type EvidenceRecord = CoreEvidenceRecord;
