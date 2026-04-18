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
}
