import type { AgentSkillReuseRecord } from '@agent/core';

export type SkillDraftStatus = 'draft' | 'shadow' | 'active' | 'trusted' | 'rejected' | 'retired';

export type RuntimeWorkspaceStatus = 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'canceled';

export type RuntimeWorkspaceTaskOutcome = 'succeeded' | 'failed' | 'canceled' | 'partial';

export type RuntimeWorkspaceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RuntimeWorkspaceCapabilitySeverity = 'low' | 'medium' | 'high';

export type RuntimeWorkspaceExecutionMode = 'plan' | 'execute' | 'imperial_direct';

export type RuntimeWorkspaceInteractionKind = 'approval' | 'plan-question' | 'supplemental-input';

export interface RuntimeWorkspaceCurrentTaskRecord extends Record<string, unknown> {
  taskId: string;
  title?: string;
  status: string;
  executionMode?: RuntimeWorkspaceExecutionMode;
  interactionKind?: RuntimeWorkspaceInteractionKind;
}

export interface RuntimeWorkspaceEvidenceSummary extends Record<string, unknown> {
  evidenceId: string;
  title?: string;
  summary?: string;
  sourceKind?: string;
  citationId?: string;
}

export interface RuntimeWorkspaceReuseBadge extends Record<string, unknown> {
  kind: 'memory' | 'rule' | 'skill';
  id: string;
  label: string;
  confidence?: number;
}

export interface RuntimeWorkspaceCapabilityGap extends Record<string, unknown> {
  capabilityId?: string;
  label: string;
  severity?: RuntimeWorkspaceCapabilitySeverity;
  suggestedAction?: string;
}

export interface RuntimeWorkspaceLearningEvidenceRef extends Record<string, unknown> {
  evidenceId: string;
  title?: string;
  sourceKind?: string;
}

export interface RuntimeWorkspaceLearningHint extends Record<string, unknown> {
  id: string;
  summary: string;
  confidence?: number;
}

export interface RuntimeWorkspaceSkillDraftRef extends Record<string, unknown> {
  draftId: string;
  status: SkillDraftStatus;
}

export interface RuntimeWorkspaceLearningSummaryRecord extends Record<string, unknown> {
  taskId: string;
  sessionId?: string;
  generatedAt: string;
  summary: string;
  outcome?: RuntimeWorkspaceTaskOutcome;
  evidenceRefs?: RuntimeWorkspaceLearningEvidenceRef[];
  memoryHints?: RuntimeWorkspaceLearningHint[];
  ruleHints?: RuntimeWorkspaceLearningHint[];
  skillDraftRefs?: RuntimeWorkspaceSkillDraftRef[];
  capabilityGaps?: RuntimeWorkspaceCapabilityGap[];
}

export interface RuntimeWorkspaceSkillDraftRecord extends Record<string, unknown> {
  draftId: string;
  status: SkillDraftStatus;
  title: string;
  summary: string;
  sourceTaskId?: string;
  sessionId?: string;
  confidence?: number;
  riskLevel?: RuntimeWorkspaceRiskLevel;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  install?: RuntimeWorkspaceSkillDraftInstallSummary;
  provenance?: RuntimeWorkspaceSkillDraftProvenanceSummary;
  lifecycle?: RuntimeWorkspaceSkillDraftLifecycleSummary;
}

export interface RuntimeWorkspaceSkillDraftInstallSummary extends Record<string, unknown> {
  receiptId: string;
  skillId: string;
  sourceId: string;
  version?: string;
  status: 'not_requested' | 'pending' | 'approved' | 'installing' | 'installed' | 'failed' | 'rejected';
  phase?: 'requested' | 'approved' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'failed';
  installedAt?: string;
  failureCode?: string;
}

export interface RuntimeWorkspaceSkillDraftProvenanceSummary extends Record<string, unknown> {
  sourceKind: 'workspace-draft';
  sourceTaskId?: string;
  sourceEvidenceIds?: string[];
  evidenceCount?: number;
  evidenceRefs?: RuntimeWorkspaceEvidenceSummary[];
  manifestId?: string;
  manifestSourceId?: 'workspace-skill-drafts';
}

export interface RuntimeWorkspaceSkillDraftLifecycleSummary extends Record<string, unknown> {
  draftStatus: SkillDraftStatus;
  installStatus?: string;
  reusable: boolean;
  nextAction?:
    | 'review_draft'
    | 'install_from_skill_lab'
    | 'approve_install'
    | 'retry_install'
    | 'ready_to_reuse'
    | 'none';
}

export interface RuntimeWorkspaceRecord extends Record<string, unknown> {
  workspaceId: string;
  sessionId?: string;
  taskId?: string;
  status: RuntimeWorkspaceStatus;
  generatedAt: string;
  updatedAt: string;
  currentTask?: RuntimeWorkspaceCurrentTaskRecord;
  learningSummary?: RuntimeWorkspaceLearningSummaryRecord;
  evidence?: RuntimeWorkspaceEvidenceSummary[];
  reuseBadges?: RuntimeWorkspaceReuseBadge[];
  capabilityGaps?: RuntimeWorkspaceCapabilityGap[];
}

export interface BuildRuntimeWorkspaceCenterInput {
  workspace: RuntimeWorkspaceRecord;
  skillDrafts?: RuntimeWorkspaceSkillDraftRecord[];
  learningSummaries?: RuntimeWorkspaceLearningSummaryRecord[];
  reuseRecords?: AgentSkillReuseRecord[];
}

export interface RuntimeWorkspaceCenterRecord {
  workspaceId: string;
  sessionId?: string;
  taskId?: string;
  status: RuntimeWorkspaceStatus;
  generatedAt: string;
  updatedAt: string;
  currentTask?: RuntimeWorkspaceCurrentTaskRecord;
  learningSummary?: RuntimeWorkspaceLearningSummaryRecord;
  learningSummaries: RuntimeWorkspaceLearningSummaryRecord[];
  skillDrafts: RuntimeWorkspaceSkillDraftRecord[];
  reuseRecords: AgentSkillReuseRecord[];
  evidence: RuntimeWorkspaceEvidenceSummary[];
  reuseBadges: RuntimeWorkspaceReuseBadge[];
  capabilityGaps: RuntimeWorkspaceCapabilityGap[];
  totals: {
    tasks: number;
    learningSummaries: number;
    skillDrafts: number;
    pendingSkillDrafts: number;
    reuseRecords: number;
  };
  skillDraftStatusCounts: Record<SkillDraftStatus, number>;
}
