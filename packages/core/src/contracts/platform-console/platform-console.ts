import type { PlatformApprovalRecord } from '../../platform-console/types/platform-console.types';

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
