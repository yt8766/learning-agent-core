import type {
  WorkspaceCenterDraft,
  WorkspaceCenterRecord,
  WorkspaceSkillDraftInstallSummary,
  WorkspaceSkillDraftLifecycleSummary,
  WorkspaceSkillDraftProvenanceSummary,
  WorkspaceSkillDraftDecisionResponse
} from '@/features/workspace-center/workspace-center-types';

import { request } from './admin-api-core';

type RuntimeWorkspaceSkillDraftRecord = {
  draftId: string;
  status: WorkspaceCenterRecord['drafts'][number]['status'];
  title: string;
  summary?: string;
  sourceTaskId?: string;
  confidence?: number;
  riskLevel?: WorkspaceCenterRecord['drafts'][number]['riskLevel'];
  createdAt: string;
  updatedAt: string;
  install?: Partial<WorkspaceSkillDraftInstallSummary> &
    Pick<WorkspaceSkillDraftInstallSummary, 'receiptId' | 'status'>;
  provenance?: WorkspaceSkillDraftProvenanceSummary;
  lifecycle?: Partial<WorkspaceSkillDraftLifecycleSummary>;
};

type RuntimeWorkspaceCenterRecord = {
  workspaceId: string;
  generatedAt: string;
  updatedAt: string;
  skillDrafts: RuntimeWorkspaceSkillDraftRecord[];
  reuseRecords?: WorkspaceCenterRecord['reuseRecords'];
  skillDraftStatusCounts?: Partial<Record<WorkspaceCenterRecord['drafts'][number]['status'], number>>;
};

type RuntimeWorkspaceSkillDraftDecisionResponse = Omit<WorkspaceSkillDraftDecisionResponse, 'draft'> & {
  draft?: WorkspaceCenterRecord['drafts'][number] | RuntimeWorkspaceSkillDraftRecord;
};

export async function getWorkspaceCenter() {
  const record = await request<WorkspaceCenterRecord | RuntimeWorkspaceCenterRecord>('/platform/workspace-center', {
    cancelKey: 'workspace-center',
    cancelPrevious: true
  });
  return normalizeWorkspaceCenterRecord(record);
}

export async function listWorkspaceSkillDrafts() {
  const drafts = await request<WorkspaceCenterRecord['drafts'] | RuntimeWorkspaceSkillDraftRecord[]>(
    '/platform/workspace-center/skill-drafts',
    {
      cancelKey: 'workspace-center:skill-drafts',
      cancelPrevious: true
    }
  );
  return drafts.map(draft => normalizeSkillDraft(draft, 'workspace-platform'));
}

export async function approveWorkspaceSkillDraft(draftId: string, note?: string) {
  const response = await request<RuntimeWorkspaceSkillDraftDecisionResponse>(
    `/platform/workspace-center/skill-drafts/${draftId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note })
    }
  );
  return normalizeSkillDraftDecisionResponse(response);
}

export async function rejectWorkspaceSkillDraft(draftId: string, reason: string) {
  const response = await request<RuntimeWorkspaceSkillDraftDecisionResponse>(
    `/platform/workspace-center/skill-drafts/${draftId}/reject`,
    {
      method: 'POST',
      body: JSON.stringify({ reason })
    }
  );
  return normalizeSkillDraftDecisionResponse(response);
}

function normalizeWorkspaceCenterRecord(
  record: WorkspaceCenterRecord | RuntimeWorkspaceCenterRecord
): WorkspaceCenterRecord {
  if ('workspace' in record) {
    return record;
  }

  const drafts = record.skillDrafts.map(draft => normalizeSkillDraft(draft, record.workspaceId));
  const activeDraftCount = drafts.filter(draft => draft.status === 'draft' || draft.status === 'shadow').length;
  const approvedDraftCount = drafts.filter(draft => draft.status === 'active' || draft.status === 'trusted').length;

  return {
    workspace: {
      id: record.workspaceId,
      profileId: record.workspaceId.replace(/^workspace-/, '') || 'platform',
      name: 'Agent Workspace',
      scope: 'platform',
      status: 'active',
      owner: {
        id: 'system',
        label: 'System',
        kind: 'system'
      },
      policyRefs: [],
      createdAt: record.generatedAt,
      updatedAt: record.updatedAt,
      summary: {
        workspaceId: record.workspaceId,
        scope: 'platform',
        activeDraftCount,
        approvedDraftCount,
        reuseRecordCount: record.reuseRecords?.length ?? 0,
        updatedAt: record.updatedAt
      }
    },
    drafts,
    reuseRecords: record.reuseRecords ?? []
  };
}

function normalizeSkillDraft(
  draft: WorkspaceCenterDraft | RuntimeWorkspaceSkillDraftRecord,
  fallbackWorkspaceId: string
): WorkspaceCenterDraft {
  if ('id' in draft) {
    return draft;
  }

  return {
    id: draft.draftId,
    workspaceId: fallbackWorkspaceId,
    title: draft.title,
    description: draft.summary ?? '',
    triggerHints: [],
    bodyMarkdown: draft.summary ?? draft.title,
    requiredTools: [],
    requiredConnectors: [],
    sourceTaskId: draft.sourceTaskId ?? 'runtime-workspace',
    sourceEvidenceIds: [],
    status: draft.status,
    riskLevel: draft.riskLevel ?? 'medium',
    confidence: draft.confidence ?? 0,
    createdBy: {
      id: 'system',
      label: 'System',
      kind: 'system'
    },
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    install: normalizeSkillDraftInstall(draft),
    provenance: draft.provenance,
    lifecycle: normalizeSkillDraftLifecycle(draft)
  };
}

function normalizeSkillDraftInstall(
  draft: RuntimeWorkspaceSkillDraftRecord
): WorkspaceSkillDraftInstallSummary | undefined {
  if (!draft.install) {
    return undefined;
  }

  return {
    receiptId: draft.install.receiptId,
    skillId: draft.install.skillId ?? `workspace-draft-${draft.draftId}`,
    sourceId: draft.install.sourceId ?? 'workspace-skill-drafts',
    version: draft.install.version,
    status: draft.install.status,
    phase: draft.install.phase,
    installedAt: draft.install.installedAt,
    failureCode: draft.install.failureCode
  };
}

function normalizeSkillDraftLifecycle(
  draft: RuntimeWorkspaceSkillDraftRecord
): WorkspaceSkillDraftLifecycleSummary | undefined {
  if (!draft.lifecycle) {
    return undefined;
  }

  return {
    draftStatus: draft.lifecycle.draftStatus ?? draft.status,
    installStatus: draft.lifecycle.installStatus,
    reusable: draft.lifecycle.reusable ?? false,
    nextAction: draft.lifecycle.nextAction
  };
}

function normalizeSkillDraftDecisionResponse(
  response: RuntimeWorkspaceSkillDraftDecisionResponse
): WorkspaceSkillDraftDecisionResponse {
  return {
    ...response,
    draft: response.draft ? normalizeSkillDraft(response.draft, 'workspace-platform') : undefined
  };
}
