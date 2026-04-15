import type {
  CompanyAgentRecord,
  ConnectorRecord,
  EvidenceRecord,
  RuleRecord,
  SessionRecord,
  SkillRecord,
  TaskRecord
} from './shared';
import type {
  EvalsCenterRecord as SharedEvalsCenterRecord,
  LearningCenterRecord as SharedLearningCenterRecord,
  PlatformApprovalRecord,
  SharedPlatformConsoleRecord,
  SkillSourcesCenterRecord
} from '@agent/shared';
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
  candidateReasons?: string[];
  skippedReasons?: string[];
  conflictDetected?: boolean;
  conflictTargets?: string[];
  derivedFromLayers?: string[];
  policyMode?: string;
  expertiseSignals?: string[];
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
  candidateReasons?: string[];
  skippedReasons?: string[];
  expertiseSignals?: string[];
  autoPersistEligible?: boolean;
  persistedMemoryIds?: string[];
  conflictDetected?: boolean;
  conflictNotes?: string[];
  createdAt: string;
  updatedAt: string;
}

export type LearningCenterRecord = SharedLearningCenterRecord;

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

export type EvalsCenterRecord = SharedEvalsCenterRecord;

export type PlatformConsoleRecord = SharedPlatformConsoleRecord<
  RuntimeCenterRecord,
  PlatformApprovalRecord,
  LearningCenterRecord,
  EvalsCenterRecord,
  SkillRecord,
  ConnectorRecord,
  RuleRecord,
  TaskRecord,
  SessionRecord,
  EvidenceRecord,
  CompanyAgentRecord,
  SkillSourcesCenterRecord
>;
