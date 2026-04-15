import type { EvidenceRecord, RuleRecord, SkillCard } from './knowledge';
import type { RuntimeCenterRecord } from './runtime-centers';
import type { CompanyAgentRecord, SkillSourcesCenterRecord } from './skills';
import type { ChatSessionRecord, TaskRecord } from './tasking';

export interface ApprovalDecisionRecord {
  intent?: string;
  decision: string;
  reason?: string;
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
    requestedBy?: string;
    reason?: string;
    riskLevel?: string;
    resumeStrategy: 'command' | 'approval-recovery';
    preview?: Array<{
      label: string;
      value: string;
    }>;
    payload?: Record<string, unknown>;
  };
  entryRouterState?: Record<string, unknown>;
  interruptControllerState?: {
    activeInterrupt?: Record<string, unknown>;
    interruptHistory: Array<Record<string, unknown>>;
  };
  planDraft?: {
    summary: string;
    autoResolved: string[];
    openQuestions: string[];
    assumptions: string[];
    questionSet?: {
      title?: string;
      summary?: string;
    };
    microBudget?: {
      readOnlyToolLimit: number;
      readOnlyToolsUsed: number;
      tokenBudgetUsd?: number;
      budgetTriggered: boolean;
    };
  };
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
  TRuntime = RuntimeCenterRecord,
  TApproval = PlatformApprovalRecord,
  TLearning = unknown,
  TEvals = unknown,
  TSkill = SkillCard,
  TConnector = unknown,
  TRule = RuleRecord,
  TTask = TaskRecord,
  TSession = ChatSessionRecord,
  TEvidence = EvidenceRecord,
  TCompanyAgent = CompanyAgentRecord,
  TSkillSources = SkillSourcesCenterRecord
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
