import type {
  ChatCheckpointRecord,
  ChatSessionRecord,
  PlatformApprovalRecord,
  SkillCard,
  TaskRecord
} from '@agent/core';
import type { z } from 'zod/v4';

import type {
  CompanyAgentsCenterRecord,
  ConnectorsCenterRecord,
  EvalsCenterRecord,
  LearningCenterRecord,
  SkillSourcesCenterRecord,
  ToolsCenterRecord
} from './runtime-centers.records';
import type {
  PlatformConsoleDiagnosticsRecordSchema,
  PlatformConsoleEvalsRecordSchema,
  PlatformConsoleEvidenceRecordSchema,
  PlatformConsoleRuntimeRecordSchema,
  PlatformConsoleRuntimeTaskRecordSchema,
  PlatformConsoleTimingRecordSchema
} from './runtime-platform-console.schemas';
import type { RuleRecord } from '@agent/memory';

export type PlatformConsoleRuntimeTaskRecord = z.infer<typeof PlatformConsoleRuntimeTaskRecordSchema>;
export type PlatformConsoleRuntimeRecord = z.infer<typeof PlatformConsoleRuntimeRecordSchema>;

export type PlatformConsoleRuntimeValue = PlatformConsoleRuntimeRecord | Record<string, unknown>;
export type PlatformConsoleLearningValue = LearningCenterRecord | Record<string, unknown>;
export type PlatformConsoleEvalsValue =
  | z.infer<typeof PlatformConsoleEvalsRecordSchema>
  | EvalsCenterRecord
  | Record<string, unknown>;

export interface RuntimePlatformConsoleContext {
  skillRegistry: {
    list: () => Promise<SkillCard[]>;
  };
  orchestrator: {
    listRules: () => Promise<RuleRecord[]>;
    listTasks: () => TaskRecord[];
  };
  sessionCoordinator: {
    listSessions: () => ChatSessionRecord[];
    getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
  };
  getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleRuntimeValue>;
  getRuntimeCenterSummary?: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleRuntimeValue>;
  getApprovalsCenter: (filters?: Record<string, unknown>) => PlatformApprovalRecord[];
  getLearningCenter: () => Promise<PlatformConsoleLearningValue>;
  getLearningCenterSummary?: () => Promise<PlatformConsoleLearningValue>;
  getEvalsCenter: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleEvalsValue>;
  getEvalsCenterSummary?: (days?: number, filters?: Record<string, unknown>) => Promise<PlatformConsoleEvalsValue>;
  getEvidenceCenter: () => Promise<PlatformConsoleRecord['evidence']>;
  getToolsCenter: () => ToolsCenterRecord;
  getConnectorsCenter: () => Promise<PlatformConsoleConnectorsRecord>;
  getSkillSourcesCenter: () => Promise<SkillSourcesCenterRecord>;
  getCompanyAgentsCenter: () => PlatformConsoleCompanyAgentsRecord;
}

export type PlatformConsoleCacheStatus = 'miss' | 'hit' | 'deduped';

export type PlatformConsoleTimingRecord = z.infer<typeof PlatformConsoleTimingRecordSchema>;
export type PlatformConsoleDiagnosticsRecord = z.infer<typeof PlatformConsoleDiagnosticsRecordSchema>;
export type PlatformConsoleEvidenceRecord = z.infer<typeof PlatformConsoleEvidenceRecordSchema>;

export type PlatformConsoleConnectorsRecord = ConnectorsCenterRecord;
export type PlatformConsoleCompanyAgentsRecord = CompanyAgentsCenterRecord;

export interface PlatformConsoleRecord {
  runtime: PlatformConsoleRuntimeValue;
  approvals: PlatformApprovalRecord[];
  learning: PlatformConsoleLearningValue;
  evals: PlatformConsoleEvalsValue;
  skills: SkillCard[];
  evidence: PlatformConsoleEvidenceRecord | unknown[];
  connectors: PlatformConsoleConnectorsRecord;
  skillSources: SkillSourcesCenterRecord;
  companyAgents: PlatformConsoleCompanyAgentsRecord | [];
  rules: RuleRecord[];
  tasks: TaskRecord[];
  sessions: ChatSessionRecord[];
  checkpoints: Array<{ session: ChatSessionRecord; checkpoint: ChatCheckpointRecord }>;
  diagnostics: PlatformConsoleDiagnosticsRecord;
}
