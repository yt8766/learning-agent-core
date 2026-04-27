import type { AgentSkillDraft, AgentSkillReuseRecord, AgentWorkspace } from '@agent/core';

export interface WorkspaceSkillDraftInstallSummary {
  receiptId: string;
  skillId: string;
  sourceId: string;
  version?: string;
  status: 'not_requested' | 'pending' | 'approved' | 'installing' | 'installed' | 'failed' | 'rejected';
  phase?: 'requested' | 'approved' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'failed';
  installedAt?: string;
  failureCode?: string;
}

export interface WorkspaceSkillDraftProvenanceSummary {
  sourceKind: 'workspace-draft';
  sourceTaskId?: string;
  sourceEvidenceIds?: string[];
  manifestId?: string;
  manifestSourceId?: 'workspace-skill-drafts';
}

export interface WorkspaceSkillDraftLifecycleSummary {
  draftStatus: AgentSkillDraft['status'];
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

export type WorkspaceCenterDraft = AgentSkillDraft & {
  install?: WorkspaceSkillDraftInstallSummary;
  provenance?: WorkspaceSkillDraftProvenanceSummary;
  lifecycle?: WorkspaceSkillDraftLifecycleSummary;
};

export interface WorkspaceCenterRecord {
  workspace: AgentWorkspace;
  drafts: WorkspaceCenterDraft[];
  reuseRecords: AgentSkillReuseRecord[];
}

export interface WorkspaceCenterPanelProps {
  workspaceCenter: WorkspaceCenterRecord;
  onApproveDraft: (draftId: string) => void;
  onRejectDraft: (draftId: string) => void;
}

export interface WorkspaceSkillDraftDecisionResponse {
  draft?: AgentSkillDraft;
  draftId?: string;
  action?: 'approve' | 'reject';
  dto?: Record<string, unknown>;
  intake?: {
    mode: 'install-candidate';
    status: 'ready';
    candidate?: {
      title: string;
      description?: string;
      bodyMarkdown: string;
      requiredTools?: string[];
      requiredConnectors?: string[];
      sourceTaskId: string;
      sourceEvidenceIds?: string[];
      riskLevel?: AgentSkillDraft['riskLevel'];
      confidence?: number;
    };
  };
}
