import type {
  CompanyAgentRecord,
  ConnectorRecord,
  EvidenceRecord,
  RuleRecord,
  SessionRecord,
  SkillRecord,
  TaskRecord
} from './shared';
import type { PlatformApprovalRecord } from '@agent/core';
import type { EvalsCenterRecord } from './evals';
import type { LearningCenterRecord } from './learning';
import type { RuntimeCenterRecord } from './runtime';
import type { SkillSourcesCenterRecord } from './governance';

export interface PlatformConsoleRecord {
  runtime: RuntimeCenterRecord;
  approvals: PlatformApprovalRecord[];
  learning: LearningCenterRecord;
  evals: EvalsCenterRecord;
  skills: SkillRecord[];
  evidence: EvidenceRecord[];
  connectors: ConnectorRecord[];
  skillSources: SkillSourcesCenterRecord;
  companyAgents: CompanyAgentRecord[];
  rules: RuleRecord[];
  tasks: TaskRecord[];
  sessions: SessionRecord[];
  diagnostics?: {
    cacheStatus: 'miss' | 'hit' | 'deduped';
    generatedAt: string;
    timingsMs: {
      total: number;
      runtime?: number;
      approvals?: number;
      evals?: number;
      learning?: number;
      connectors?: number;
      skillSources?: number;
      evidence?: number;
      companyAgents?: number;
      skills?: number;
      rules?: number;
      tasks?: number;
      sessions?: number;
      checkpoints?: number;
    };
  };
}

export interface PlatformConsoleLogAnalysisRecord {
  sampleCount: number;
  summary: {
    status: 'healthy' | 'warning' | 'critical';
    reasons: string[];
    budgetsMs: {
      freshAggregateP95: number;
      slowP95: number;
    };
  };
  byEvent: Partial<
    Record<
      'runtime.platform_console.fresh_aggregate' | 'runtime.platform_console.slow',
      {
        count: number;
        totalDurationMs: {
          min: number;
          max: number;
          avg: number;
          p50: number;
          p95: number;
        };
        timingPercentilesMs: Record<
          string,
          {
            p50: number;
            p95: number;
            max: number;
          }
        >;
      }
    >
  >;
  latestSamples: Array<{
    event: 'runtime.platform_console.fresh_aggregate' | 'runtime.platform_console.slow';
    timestamp: string;
    cacheStatus?: string;
    totalDurationMs: number;
    taskCount?: number;
    sessionCount?: number;
  }>;
}
