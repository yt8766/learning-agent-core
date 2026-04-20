import type { AgentStateRecord, ApprovalRecord } from './chat-session';
import type { ChatThinkState, ChatThoughtChainItem } from './chat-events';
import type { ChatCheckpointPlanningState } from './chat-checkpoint-planning.types';
import type { ChatCheckpointObservabilityState } from './chat-checkpoint-observability.types';
import type { ChatCheckpointCapabilityState } from './chat-checkpoint-capability.types';

export type * from './chat-execution-step.types';
export type * from './chat-checkpoint-planning.types';
export type * from './chat-checkpoint-observability.types';
export type * from './chat-checkpoint-capability.types';

import type { ExecutionStepRecord, ExecutionStepRoute } from './chat-execution-step.types';

export interface ChatCheckpointRecord
  extends ChatCheckpointPlanningState, ChatCheckpointObservabilityState, ChatCheckpointCapabilityState {
  sessionId: string;
  taskId: string;
  runId?: string;
  traceId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    command?: string;
    requiredMinistries: string[];
    allowedCapabilities: string[];
    approvalPolicy: string;
    outputContract: {
      type: string;
      requiredSections: string[];
    };
  };
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  specialistLead?: {
    id: string;
    displayName: string;
    domain: string;
    reason?: string;
  };
  supportingSpecialists?: Array<{
    id: string;
    displayName: string;
    domain: string;
    reason?: string;
  }>;
  specialistFindings?: Array<{
    specialistId: string;
    role: 'lead' | 'support';
    contractVersion: 'specialist-finding.v1';
    source: 'route' | 'research' | 'execution' | 'critique';
    stage: 'planning' | 'research' | 'execution' | 'review';
    summary: string;
    domain: string;
    riskLevel?: string;
    blockingIssues?: string[];
    constraints?: string[];
    suggestions?: string[];
    evidenceRefs?: string[];
    confidence?: number;
  }>;
  routeConfidence?: number;
  contextSlicesBySpecialist?: Array<{
    specialistId: string;
    summary?: string;
    recentTurns?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    relatedHistory?: string[];
    evidenceRefs?: string[];
    domainInstruction?: string;
    outputInstruction?: string;
  }>;
  dispatches?: Array<{
    taskId: string;
    subTaskId: string;
    from: string;
    to: string;
    kind: 'strategy' | 'ministry' | 'fallback';
    objective: string;
    specialistDomain?: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
    selectedAgentId?: string;
    selectionSource?:
      | 'explicit-agent'
      | 'strategy-counselor'
      | 'specialist-lead'
      | 'supporting-specialist'
      | 'candidate-first';
  }>;
  critiqueResult?: {
    decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    summary: string;
    blockingIssues?: string[];
    constraints?: string[];
    evidenceRefs?: string[];
    shouldBlockEarly?: boolean;
  };
  chatRoute?: {
    graph: 'workflow' | 'approval-recovery' | 'learning';
    flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
    reason: string;
    adapter:
      | 'workflow-command'
      | 'approval-recovery'
      | 'identity-capability'
      | 'figma-design'
      | 'modification-intent'
      | 'general-prompt'
      | 'research-first'
      | 'plan-only'
      | 'readiness-fallback'
      | 'fallback';
    priority: number;
    intent?: ExecutionStepRoute | 'plan-only';
    intentConfidence?: number;
    executionReadiness?:
      | 'ready'
      | 'approval-required'
      | 'missing-capability'
      | 'missing-connector'
      | 'missing-workspace'
      | 'blocked-by-policy';
    matchedSignals?: string[];
    readinessReason?: string;
    profileAdjustmentReason?: string;
    preferredExecutionMode?: 'direct-reply' | 'plan-first' | 'execute-first';
    stepsSummary?: ExecutionStepRecord[];
  };
  executionSteps?: ExecutionStepRecord[];
  currentExecutionStep?: ExecutionStepRecord;
  pendingAction?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
  };
  pendingApproval?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
    reason?: string;
    reasonCode?: string;
    feedback?: string;
    serverId?: string;
    capabilityId?: string;
    preview?: Array<{
      label: string;
      value: string;
    }>;
  };
  activeInterrupt?: {
    id: string;
    status: 'pending' | 'resolved' | 'cancelled';
    mode: 'blocking' | 'non-blocking';
    source: 'graph' | 'tool';
    kind: 'tool-approval' | 'skill-install' | 'connector-governance' | 'runtime-governance' | 'user-input';
    intent?: string;
    toolName?: string;
    family?: string;
    capabilityType?: string;
    requestedBy?: string;
    ownerType?: string;
    ownerId?: string;
    reason?: string;
    blockedReason?: string;
    riskLevel?: string;
    threadId?: string;
    checkpointId?: string;
    resumeStrategy: 'command' | 'approval-recovery';
    preview?: Array<{
      label: string;
      value: string;
    }>;
    payload?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
  };
  interruptHistory?: Array<{
    id: string;
    status: 'pending' | 'resolved' | 'cancelled';
    mode: 'blocking' | 'non-blocking';
    source: 'graph' | 'tool';
    kind: 'tool-approval' | 'skill-install' | 'connector-governance' | 'runtime-governance' | 'user-input';
    intent?: string;
    toolName?: string;
    family?: string;
    capabilityType?: string;
    requestedBy?: string;
    ownerType?: string;
    ownerId?: string;
    reason?: string;
    blockedReason?: string;
    riskLevel?: string;
    threadId?: string;
    checkpointId?: string;
    resumeStrategy: 'command' | 'approval-recovery';
    preview?: Array<{
      label: string;
      value: string;
    }>;
    payload?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
  }>;
  approvalFeedback?: string;
  modelRoute?: Array<{
    ministry: string;
    workerId: string;
    defaultModel: string;
    selectedModel: string;
    reason: string;
  }>;
  externalSources?: Array<{
    id: string;
    sourceId?: string;
    taskId: string;
    sourceType: string;
    sourceUrl?: string;
    trustClass: string;
    summary: string;
    detail?: Record<string, unknown>;
    linkedRunId?: string;
    createdAt: string;
    fetchedAt?: string;
  }>;
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  connectorRefs?: string[];
  requestedHints?: {
    requestedSpecialist?: string;
    requestedSkill?: string;
    requestedConnectorTemplate?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
    requestedCapability?: string;
    preferredMode?: 'direct-reply' | 'workflow' | 'research-first';
    createSkillIntent?: {
      description: string;
      displayName?: string;
    };
  };
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState?: {
    status: string;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
    revisionCount?: number;
    maxRevisions?: number;
    microLoopCount?: number;
    maxMicroLoops?: number;
    microLoopState?: {
      state: 'idle' | 'retrying' | 'exhausted' | 'completed';
      attempt: number;
      maxAttempts: number;
      exhaustedReason?: string;
      updatedAt: string;
    };
    revisionState?: 'idle' | 'needs_revision' | 'revising' | 'blocked' | 'completed';
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentStateRecord[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
