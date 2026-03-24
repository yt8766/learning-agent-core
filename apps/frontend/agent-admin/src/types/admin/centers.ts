import type {
  ApprovalDecisionRecord,
  ConnectorRecord,
  EvidenceRecord,
  RuleRecord,
  SessionRecord,
  SkillRecord,
  TaskRecord
} from './core';
import type { RuntimeCenterRecord } from './runtime';

export interface LearningCandidateItem {
  id: string;
  taskId: string;
  taskGoal: string;
  type: string;
  summary: string;
  status: string;
  currentMinistry?: string;
  currentWorker?: string;
  confidenceScore?: number;
  autoConfirmEligible?: boolean;
  provenanceCount?: number;
  evaluationScore?: number;
  evaluationConfidence?: string;
  createdAt: string;
}

export interface LearningJobRecord {
  id: string;
  sourceType: string;
  status: string;
  documentUri: string;
  goal?: string;
  workflowId?: string;
  summary?: string;
  sourceCount?: number;
  trustSummary?: Record<string, number>;
  evaluationScore?: number;
  evaluationConfidence?: string;
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LearningCenterRecord {
  totalCandidates: number;
  pendingCandidates: number;
  confirmedCandidates: number;
  researchJobs?: number;
  averageEvaluationScore?: number;
  autoConfirmableCandidates?: number;
  autoPersistedResearchJobs?: number;
  conflictingResearchJobs?: number;
  invalidatedMemories?: number;
  invalidatedRules?: number;
  candidates: LearningCandidateItem[];
  recentJobs?: LearningJobRecord[];
}

export interface EvalScenarioRecord {
  scenarioId: string;
  label: string;
  description: string;
  matchedRunCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
}

export interface EvalTrendPointRecord {
  day: string;
  runCount: number;
  passCount: number;
  passRate: number;
}

export interface EvalRunRecord {
  taskId: string;
  scenarioIds: string[];
  success: boolean;
  createdAt: string;
}

export interface EvalScenarioTrendRecord {
  scenarioId: string;
  label: string;
  points: EvalTrendPointRecord[];
}

export interface EvalsCenterRecord {
  scenarioCount: number;
  runCount: number;
  overallPassRate: number;
  appliedFilters?: {
    scenarioId?: string;
    outcome?: string;
  };
  scenarios: EvalScenarioRecord[];
  recentRuns: EvalRunRecord[];
  dailyTrend: EvalTrendPointRecord[];
  scenarioTrends: EvalScenarioTrendRecord[];
  historyDays?: number;
  historyRange?: {
    earliestDay?: string;
    latestDay?: string;
  };
  persistedDailyHistory?: Array<{
    day: string;
    runCount: number;
    passCount: number;
    passRate: number;
    scenarioCount: number;
    overallPassRate: number;
    updatedAt: string;
  }>;
}

export interface PlatformConsoleRecord {
  runtime: RuntimeCenterRecord;
  approvals: Array<{
    taskId: string;
    goal: string;
    status: string;
    sessionId?: string;
    currentMinistry?: string;
    currentWorker?: string;
    approvals: ApprovalDecisionRecord[];
  }>;
  learning: LearningCenterRecord;
  evals: EvalsCenterRecord;
  skills: SkillRecord[];
  evidence: EvidenceRecord[];
  connectors: ConnectorRecord[];
  rules: RuleRecord[];
  tasks: TaskRecord[];
  sessions: SessionRecord[];
}
