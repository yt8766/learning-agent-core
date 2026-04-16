export {
  BlackboardStateRecordSchema,
  BudgetGateStateRecordSchema,
  ComplexTaskPlanRecordSchema,
  ContextSliceRecordSchema,
  CritiqueResultRecordSchema,
  CurrentSkillExecutionRecordSchema,
  DispatchInstructionSchema,
  GovernanceReportRecordSchema,
  GovernanceScoreRecordSchema,
  MicroLoopStateRecordSchema,
  AgentExecutionStateSchema,
  AgentMessageRecordSchema,
  ManagerPlanSchema,
  ReviewRecordSchema,
  SpecialistFindingRecordSchema,
  SpecialistLeadRecordSchema,
  SpecialistSupportRecordSchema,
  SubTaskRecordSchema
} from '@agent/core';
export type {
  AgentExecutionState,
  AgentMessageRecord as AgentMessage,
  LearningCandidateRecord,
  ManagerPlan,
  ReviewRecord,
  SubTaskRecord
} from '@agent/core';

import type { ApprovalInterruptRecord } from './governance';
import type {
  AgentRole,
  ApprovalStatus,
  ChatRole,
  CritiqueDecision,
  ExecutionPlanMode,
  ReviewDecision,
  SpecialistDomain,
  WorkerDomain
} from './primitives';
import type { EvaluationResult, EvidenceRecord, MemoryRecord, ReflectionResult, SkillCard } from './knowledge';

export interface AgentState {
  taskId: string;
  goal: string;
  context?: string;
  constraints: string[];
  currentPlan: string[];
  currentStep?: string;
  toolIntent?: import('./primitives').ActionIntent;
  approvalRequired: boolean;
  approvalStatus?: ApprovalStatus;
  observations: string[];
  retrievedMemories: MemoryRecord[];
  retrievedSkills: SkillCard[];
  evaluation?: EvaluationResult;
  reflection?: ReflectionResult;
  finalAnswer?: string;
}

export interface DispatchInstruction {
  taskId: string;
  subTaskId: string;
  from: AgentRole;
  to: AgentRole;
  kind: 'strategy' | 'ministry' | 'fallback';
  objective: string;
}

export interface GovernanceScoreRecord {
  ministry: 'libu-governance';
  score: number;
  status: 'healthy' | 'watch' | 'risky';
  summary: string;
  rationale: string[];
  recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
  trustAdjustment: 'promote' | 'hold' | 'downgrade';
  updatedAt: string;
}

export interface GovernanceReportRecord {
  ministry: 'libu-governance';
  summary: string;
  executionQuality: {
    score: number;
    summary: string;
  };
  evidenceSufficiency: {
    score: number;
    summary: string;
  };
  sandboxReliability: {
    score: number;
    summary: string;
  };
  reviewOutcome: {
    decision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    summary: string;
  };
  interruptLoad: {
    interruptCount: number;
    microLoopCount: number;
    summary: string;
  };
  businessFeedback: {
    score: number;
    summary: string;
  };
  recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'>;
  trustAdjustment: 'promote' | 'hold' | 'downgrade';
  updatedAt: string;
}

export interface BudgetGateStateRecord {
  node: 'budget_gate';
  status: 'open' | 'soft_blocked' | 'hard_blocked' | 'throttled';
  summary: string;
  queueDepth?: number;
  rateLimitKey?: string;
  triggeredAt?: string;
  updatedAt: string;
}

export interface ComplexTaskPlanRecord {
  node: 'complex_task_plan';
  status: 'pending' | 'completed' | 'blocked';
  summary: string;
  subGoals: string[];
  dependencies: Array<{
    from: string;
    to: string;
  }>;
  recoveryPoints?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlackboardStateRecord {
  node: 'blackboard_state';
  taskId: string;
  sessionId?: string;
  visibleScopes: Array<'supervisor' | 'strategy' | 'ministry' | 'fallback' | 'governance'>;
  refs: {
    traceCount: number;
    evidenceCount: number;
    checkpointId?: string;
    activeInterruptId?: string;
  };
  updatedAt: string;
}

export interface MicroLoopStateRecord {
  state: 'idle' | 'retrying' | 'exhausted' | 'completed';
  attempt: number;
  maxAttempts: number;
  exhaustedReason?: string;
  updatedAt: string;
}

export interface AgentTokenEvent {
  taskId: string;
  role: AgentRole;
  messageId: string;
  token: string;
  model?: string;
  createdAt: string;
}

export interface SpecialistLeadRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

export interface SpecialistSupportRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

export interface SpecialistFindingRecord {
  specialistId: SpecialistDomain;
  role: 'lead' | 'support';
  contractVersion: 'specialist-finding.v1';
  source: 'route' | 'research' | 'execution' | 'critique';
  stage: 'planning' | 'research' | 'execution' | 'review';
  summary: string;
  domain: SpecialistDomain;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  blockingIssues?: string[];
  constraints?: string[];
  suggestions?: string[];
  evidenceRefs?: string[];
  confidence?: number;
}

export interface ContextSliceRecord {
  specialistId: SpecialistDomain;
  summary?: string;
  recentTurns?: Array<{
    role: ChatRole;
    content: string;
  }>;
  relatedHistory?: string[];
  evidenceRefs?: string[];
  domainInstruction?: string;
  outputInstruction?: string;
}

export interface CritiqueResultRecord {
  contractVersion: 'critique-result.v1';
  decision: CritiqueDecision;
  summary: string;
  blockingIssues?: string[];
  constraints?: string[];
  evidenceRefs?: string[];
  shouldBlockEarly?: boolean;
}

export interface CurrentSkillExecutionRecord {
  skillId: string;
  displayName: string;
  phase: 'research' | 'execute';
  stepIndex: number;
  totalSteps: number;
  title: string;
  instruction: string;
  toolNames?: string[];
  updatedAt: string;
}

export interface ContextFilterRecord {
  node: 'context_filter';
  status: 'pending' | 'completed' | 'blocked';
  filteredContextSlice: {
    summary: string;
    historyTraceCount: number;
    evidenceCount: number;
    specialistCount: number;
    ministryCount: number;
    compressionApplied?: boolean;
    compressionSource?: 'heuristic' | 'llm';
    compressedMessageCount?: number;
    artifactCount?: number;
    originalCharacterCount?: number;
    compactedCharacterCount?: number;
    reactiveRetryCount?: number;
    pipelineAudit?: Array<{
      stage:
        | 'large_result_offload'
        | 'micro_compression'
        | 'history_trim'
        | 'projection'
        | 'conversation_summary'
        | 'reactive_compact_retry';
      applied: boolean;
      reason: string;
      originalSize?: number;
      compactedSize?: number;
      artifactIds?: string[];
      triggeredBy?: string;
    }>;
  };
  audienceSlices?: {
    strategy: {
      summary: string;
      dispatchCount: number;
    };
    ministry: {
      summary: string;
      dispatchCount: number;
    };
    fallback: {
      summary: string;
      dispatchCount: number;
    };
  };
  dispatchOrder?: Array<'strategy' | 'ministry' | 'fallback'>;
  noiseGuards?: string[];
  hiddenTraceCount?: number;
  redactedKeys?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FinalReviewRecord {
  node: 'final_review';
  ministry: WorkerDomain;
  decision: 'pass' | 'revise_required' | 'block';
  summary: string;
  interruptRequired: boolean;
  deliveryStatus?: 'pending' | 'delivered' | 'interrupted';
  deliveryMinistry?: WorkerDomain;
  createdAt: string;
  updatedAt: string;
}

export interface GuardrailStateRecord {
  stage: 'pre' | 'post';
  verdict: 'pass_through' | 'rewrite_required' | 'block';
  summary: string;
  eventId?: string;
  updatedAt: string;
}

export interface CriticStateRecord {
  node: 'critic';
  decision: 'pass_through' | 'rewrite_required';
  summary: string;
  blockingIssues?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SandboxStateRecord {
  node: 'sandbox';
  stage: 'gongbu' | 'bingbu' | 'review';
  status: 'idle' | 'running' | 'passed' | 'failed' | 'exhausted';
  attempt: number;
  maxAttempts: number;
  verdict?: 'safe' | 'unsafe' | 'retry';
  exhaustedReason?: string;
  updatedAt: string;
}

export interface KnowledgeIngestionStateRecord {
  node: 'knowledge_ingestion';
  store: import('./primitives').KnowledgeStore;
  sourceId?: string;
  receiptId?: string;
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed';
  updatedAt: string;
}

export interface KnowledgeIndexStateRecord {
  node: 'knowledge_index';
  store: import('./primitives').KnowledgeStore;
  indexStatus: 'ready' | 'partial' | 'building' | 'failed';
  searchableDocumentCount?: number;
  blockedDocumentCount?: number;
  updatedAt: string;
}

export interface EvaluationReportRecord {
  id: string;
  ministry: 'libu-governance';
  score: number;
  summary: string;
  rlaifNotes: string[];
  derivedFromTaskId: string;
  derivedFromTraceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalSubAgentResult {
  agentId: string;
  status: 'continue' | 'needs_user_input' | 'needs_revision' | 'blocked';
  interactionKind?: 'plan-question' | 'supplemental-input';
  summary?: string;
  questions?: import('./tasking-planning').PlanQuestionRecord[];
  createdAt: string;
}
