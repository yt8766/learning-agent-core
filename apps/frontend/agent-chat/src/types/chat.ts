export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'cancelled'
  | 'completed'
  | 'failed';

export interface ApprovalRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface AgentStateRecord {
  role: string;
  status: string;
  subTask?: string;
  finalOutput?: string;
  observations?: string[];
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  status: ChatSessionStatus;
  currentTaskId?: string;
  compression?: {
    summary: string;
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
    trigger: 'message_count' | 'character_count';
    source: 'heuristic' | 'llm';
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  linkedAgent?: string;
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        riskLevel?: string;
        requestedBy?: string;
      }
    | {
        type: 'run_cancelled';
        reason?: string;
      }
    | {
        type: 'evidence_digest';
        sources: Array<{
          id: string;
          sourceType: string;
          sourceUrl?: string;
          trustClass: string;
          summary: string;
          fetchedAt?: string;
          detail?: Record<string, unknown>;
        }>;
      }
    | {
        type: 'learning_summary';
        score: number;
        confidence: 'low' | 'medium' | 'high';
        notes: string[];
        skillGovernanceRecommendations: Array<{
          skillId: string;
          recommendation: 'promote' | 'keep-lab' | 'disable' | 'retire';
          successRate?: number;
          promotionState?: string;
        }>;
        recommendedCount: number;
        autoConfirmCount: number;
      }
    | {
        type: 'skill_reuse';
        reusedSkills: string[];
        usedInstalledSkills: string[];
        usedCompanyWorkers: string[];
      }
    | {
        type: 'worker_dispatch';
        currentMinistry?: string;
        currentWorker?: string;
        routeReason?: string;
        chatRoute?: {
          flow: 'supervisor' | 'approval' | 'learning' | 'direct-reply';
          reason: string;
          adapter: string;
          priority: number;
        };
        usedInstalledSkills: string[];
        usedCompanyWorkers: string[];
      }
    | {
        type: 'skill_suggestions';
        capabilityGapDetected: boolean;
        status: 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';
        safetyNotes: string[];
        suggestions: Array<{
          id: string;
          kind: 'installed' | 'manifest' | 'connector-template';
          displayName: string;
          summary: string;
          sourceId?: string;
          score: number;
          availability:
            | 'ready'
            | 'installable'
            | 'installable-local'
            | 'installable-remote'
            | 'approval-required'
            | 'blocked';
          reason: string;
          requiredCapabilities: string[];
          requiredConnectors?: string[];
          version?: string;
          sourceLabel?: string;
          sourceTrustClass?: string;
          installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
          successRate?: number;
          governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
          safety?: {
            verdict: 'allow' | 'needs-approval' | 'blocked';
            trustScore: number;
            sourceTrustClass?: string;
            profileCompatible?: boolean;
            maxRiskLevel: string;
            reasons: string[];
            riskyTools: string[];
            missingDeclarations: string[];
          };
        }>;
      }
    | {
        type: 'runtime_issue';
        severity: 'warning' | 'error';
        title: string;
        notes: string[];
      };
  createdAt: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatThoughtChainItem {
  key: string;
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
}

export interface ChatThinkState {
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
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
      | 'fallback';
    priority: number;
  };
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
    feedback?: string;
  };
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
  learningEvaluation?: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
    notes: string[];
    governanceWarnings?: string[];
    skillGovernanceRecommendations?: Array<{
      skillId: string;
      recommendation: 'promote' | 'keep-lab' | 'disable' | 'retire';
      successRate?: number;
      promotionState?: string;
    }>;
    recommendedCandidateIds: string[];
    autoConfirmCandidateIds: string[];
    sourceSummary: {
      externalSourceCount: number;
      internalSourceCount: number;
      reusedMemoryCount: number;
      reusedRuleCount: number;
      reusedSkillCount: number;
    };
  };
  skillSearch?: {
    capabilityGapDetected: boolean;
    status: 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';
    safetyNotes: string[];
    suggestions: Array<{
      id: string;
      kind: 'installed' | 'manifest' | 'connector-template';
      displayName: string;
      summary: string;
      sourceId?: string;
      score: number;
      availability:
        | 'ready'
        | 'installable'
        | 'installable-local'
        | 'installable-remote'
        | 'approval-required'
        | 'blocked';
      reason: string;
      requiredCapabilities: string[];
      requiredConnectors?: string[];
      version?: string;
      sourceLabel?: string;
      sourceTrustClass?: string;
      installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
      successRate?: number;
      governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
      safety?: {
        verdict: 'allow' | 'needs-approval' | 'blocked';
        trustScore: number;
        sourceTrustClass?: string;
        profileCompatible?: boolean;
        maxRiskLevel: string;
        reasons: string[];
        riskyTools: string[];
        missingDeclarations: string[];
      };
    }>;
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
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentStateRecord[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
