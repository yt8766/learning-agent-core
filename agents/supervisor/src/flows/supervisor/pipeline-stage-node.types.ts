import type {
  ChatRouteRecord,
  ExecutionStepRecord,
  InternalSubAgentResult,
  PlannerStrategyRecord,
  PlanDraftRecord,
  WorkflowPresetDefinition
} from '@agent/core';
import type { AgentRoleValue as AgentRole } from './supervisor-architecture-helpers';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';

export interface SupervisorPlanningTaskLike {
  id: string;
  goal: string;
  context?: string;
  status?: string;
  result?: string;
  skillId?: string;
  currentNode?: string;
  currentStep?: string;
  mainChainNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  skillStage?: string;
  executionMode?: string;
  routeConfidence?: number;
  plannerStrategy?: PlannerStrategyRecord;
  resolvedWorkflow?: WorkflowPresetDefinition;
  entryDecision?: {
    requestedMode?: string;
    counselorSelector?: {
      selectedCounselorId?: string;
    };
  };
  modelRoute?: Array<{
    ministry?: string;
    workerId?: string;
    selectedModel?: string;
  }>;
  specialistLead?: {
    id: string;
    domain?: string;
    displayName: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  };
  supportingSpecialists?: Array<{
    id: string;
    domain?: string;
    displayName: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  }>;
  executionPlan?: {
    mode?: string;
    strategyCounselors?: string[];
    selectedCounselorId?: string;
    executionMinistries?: string[];
    modeCapabilities?: string[];
    partialAggregationPolicy?: {
      allowedOutputKinds?: string[];
    };
  };
  plan?: {
    id: string;
    goal: string;
    summary: string;
    steps: string[];
    subTasks: Array<{
      id: string;
      title: string;
      description: string;
      assignedTo: 'manager' | 'research' | 'executor' | 'reviewer';
      requiredCapabilities?: string[];
      status: 'running' | 'blocked' | 'completed' | 'pending';
    }>;
    createdAt: string;
  };
  complexTaskPlan?: {
    node?: string;
    status?: string;
    summary?: string;
    subGoals?: string[];
    dependencies?: Array<{
      from: string;
      to: string;
    }>;
    recoveryPoints?: string[];
    createdAt?: string;
    updatedAt?: string;
  };
  modeGateState?: {
    requestedMode?: string;
    activeMode?: string;
    reason?: string;
    updatedAt?: string;
  };
  guardrailState?: {
    stage?: string;
    verdict?: string;
    summary?: string;
    updatedAt?: string;
  };
  planMode?: 'intent' | 'implementation' | 'finalized' | 'aborted';
  planModeTransitions?: Array<{
    from?: string;
    to: string;
    reason: string;
    at: string;
  }>;
  planDraft?: PlanDraftRecord;
  partialAggregation?: {
    kind: string;
    summary: string;
    requiresApproval: boolean;
    recommendedNextStep?: string;
    allowedCapabilities?: string[];
    sourceCounselorIds?: string[];
    createdAt: string;
  };
  internalSubAgents?: InternalSubAgentResult[];
  queueState?: {
    status?: string;
    startedAt?: string;
    lastTransitionAt?: string;
  };
  activeInterrupt?: {
    id: string;
    status: string;
    mode?: string;
    source?: string;
    origin?: string;
    proxySourceAgentId?: string;
    kind?: string;
    interactionKind?: 'plan-question' | 'supplemental-input' | string;
    requestedBy?: string;
    ownerType?: string;
    ownerId?: string;
    reason?: string;
    blockedReason?: string;
    resumeStrategy?: string;
    timeoutMinutes?: number;
    timeoutPolicy?: string;
    payload?: Record<string, unknown>;
    createdAt: string;
    resolvedAt?: string;
  };
  interruptHistory?: Array<NonNullable<SupervisorPlanningTaskLike['activeInterrupt']>>;
  approvals: Array<{
    taskId: string;
    intent?: string;
    actor?: string;
    reason?: string;
    decision?: string;
    decidedAt?: string;
  }>;
  review?: unknown;
  currentExecutionStep?: ExecutionStepRecord;
  executionSteps?: ExecutionStepRecord[];
  chatRoute?: ChatRouteRecord;
  contextFilterState?: {
    dispatchOrder?: Array<'strategy' | 'ministry' | 'fallback'>;
    noiseGuards?: string[];
    createdAt?: string;
    hiddenTraceCount?: number;
    audienceSlices?: unknown;
    filteredContextSlice?: {
      summary?: string;
    };
    node?: string;
    status?: string;
    updatedAt?: string;
    redactedKeys?: string[];
  };
  trace: Array<{
    node?: string;
    summary?: string;
  }>;
  externalSources?: Array<{
    sourceType?: string;
  }>;
  capabilityAttachments?: Array<{
    id: string;
    kind: string;
    enabled?: boolean;
    displayName: string;
    sourceId?: string;
    owner: {
      ownerType: string;
    };
    metadata?: {
      steps?: Array<{
        title: string;
        instruction: string;
        toolNames?: string[];
      }>;
      requiredConnectors?: string[];
      approvalSensitiveTools?: string[];
    };
  }>;
  requestedHints?: {
    requestedSkill?: string;
  };
}

export interface PlanningCallbacks<TTask extends SupervisorPlanningTaskLike = SupervisorPlanningTaskLike> {
  ensureTaskNotCancelled: (task: TTask) => void;
  syncTaskRuntime: (
    task: TTask,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  addTrace: (task: TTask, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TTask, content: string, from?: AgentRole) => void;
  attachTool?: (
    task: TTask,
    params: {
      toolName: string;
      attachedBy: 'bootstrap' | 'user' | 'runtime' | 'workflow' | 'specialist';
      preferred?: boolean;
      reason?: string;
      ownerType?: 'shared' | 'ministry-owned' | 'specialist-owned' | 'user-attached' | 'runtime-derived';
      ownerId?: string;
      family?: string;
    }
  ) => void;
  recordToolUsage?: (
    task: TTask,
    params: {
      toolName: string;
      status: 'suggested' | 'used' | 'blocked' | 'approved' | 'rejected';
      requestedBy?: string;
      reason?: string;
      blockedReason?: string;
      serverId?: string;
      capabilityId?: string;
      approvalRequired?: boolean;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      route?: 'local' | 'mcp' | 'governance';
      family?: string;
      capabilityType?: 'local-tool' | 'mcp-capability' | 'governance-tool';
    }
  ) => void;
  persistAndEmitTask: (task: TTask) => Promise<void>;
  resolveWorkflowRoutes: (task: TTask, workflow?: TTask['resolvedWorkflow']) => TTask['modelRoute'];
  markWorkerUsage: (task: TTask, workerId?: string) => void;
  recordDispatches: (task: TTask, dispatches: RuntimeAgentGraphState['dispatches']) => void;
}
