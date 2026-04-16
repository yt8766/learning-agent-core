export interface ApprovalDecisionRecord {
  intent?: string;
  decision: string;
  reason?: string;
}

export interface PlatformApprovalPreviewItem {
  label: string;
  value: string;
}

export interface PlatformApprovalInterruptRecord {
  id: string;
  status: 'pending' | 'resolved' | 'cancelled';
  mode: 'blocking' | 'non-blocking';
  source: 'graph' | 'tool';
  kind: 'tool-approval' | 'skill-install' | 'connector-governance' | 'runtime-governance' | 'user-input';
  intent?: string;
  toolName?: string;
  requestedBy?: string;
  reason?: string;
  riskLevel?: string;
  resumeStrategy: 'command' | 'approval-recovery';
  preview?: PlatformApprovalPreviewItem[];
  payload?: Record<string, unknown>;
}

export interface PlatformApprovalQuestionSetRecord {
  title?: string;
  summary?: string;
}

export interface PlatformApprovalMicroBudgetRecord {
  readOnlyToolLimit: number;
  readOnlyToolsUsed: number;
  tokenBudgetUsd?: number;
  budgetTriggered: boolean;
}

export interface PlatformApprovalPlanDraftRecord {
  summary: string;
  autoResolved: string[];
  openQuestions: string[];
  assumptions: string[];
  questionSet?: PlatformApprovalQuestionSetRecord;
  microBudget?: PlatformApprovalMicroBudgetRecord;
}

export interface PlatformApprovalRecord {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  currentMinistry?: string;
  currentWorker?: string;
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  pendingApproval?: {
    toolName?: string;
    intent?: string;
    riskLevel?: string;
    requestedBy?: string;
    reason?: string;
    reasonCode?: string;
    preview?: PlatformApprovalPreviewItem[];
  };
  activeInterrupt?: PlatformApprovalInterruptRecord;
  entryRouterState?: Record<string, unknown>;
  interruptControllerState?: {
    activeInterrupt?: Record<string, unknown>;
    interruptHistory: Array<Record<string, unknown>>;
  };
  planDraft?: PlatformApprovalPlanDraftRecord;
  approvals: ApprovalDecisionRecord[];
  commandPreview?: string;
  riskReason?: string;
  riskCode?: string;
  approvalScope?: 'once' | 'session' | 'always' | string;
  policyMatchStatus?: string;
  policyMatchSource?: string;
  lastStreamStatusAt?: string;
}

export interface SharedPlatformConsoleRecord<
  TRuntime = unknown,
  TApproval = PlatformApprovalRecord,
  TLearning = unknown,
  TEvals = unknown,
  TSkill = unknown,
  TConnector = unknown,
  TRule = unknown,
  TTask = unknown,
  TSession = unknown,
  TEvidence = unknown,
  TCompanyAgent = unknown,
  TSkillSources = unknown
> {
  runtime: TRuntime;
  approvals: TApproval[];
  learning: TLearning;
  evals: TEvals;
  skills: TSkill[];
  evidence: TEvidence[];
  connectors: TConnector[];
  skillSources: TSkillSources;
  companyAgents: TCompanyAgent[];
  rules: TRule[];
  tasks: TTask[];
  sessions: TSession[];
}
