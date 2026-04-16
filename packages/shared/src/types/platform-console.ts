import type {
  ApprovalDecisionRecord,
  PlatformApprovalInterruptRecord,
  PlatformApprovalMicroBudgetRecord,
  PlatformApprovalPlanDraftRecord,
  PlatformApprovalPreviewItem,
  PlatformApprovalQuestionSetRecord,
  PlatformApprovalRecord as CorePlatformApprovalRecord,
  SharedPlatformConsoleRecord as CoreSharedPlatformConsoleRecord
} from '@agent/core';

import type { EvidenceRecord, RuleRecord, SkillCard } from './knowledge';
import type { RuntimeCenterRecord } from './runtime-centers';
import type { CompanyAgentRecord, SkillSourcesCenterRecord } from './skills';
import type { ChatSessionRecord, TaskRecord } from './tasking';

export type {
  ApprovalDecisionRecord,
  PlatformApprovalInterruptRecord,
  PlatformApprovalMicroBudgetRecord,
  PlatformApprovalPlanDraftRecord,
  PlatformApprovalPreviewItem,
  PlatformApprovalQuestionSetRecord
};

export type PlatformApprovalRecord = CorePlatformApprovalRecord;

export type SharedPlatformConsoleRecord<
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
> = CoreSharedPlatformConsoleRecord<
  TRuntime,
  TApproval,
  TLearning,
  TEvals,
  TSkill,
  TConnector,
  TRule,
  TTask,
  TSession,
  TEvidence,
  TCompanyAgent,
  TSkillSources
>;
