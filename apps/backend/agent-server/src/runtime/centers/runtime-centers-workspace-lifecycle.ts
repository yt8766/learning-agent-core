import type { SkillInstallReceipt } from '@agent/core';

import type { RuntimeWorkspaceDraftProjection } from './runtime-centers-workspace-drafts';
import { WORKSPACE_SKILL_DRAFT_SOURCE_ID } from '../domain/skills/runtime-workspace-skill-draft-manifests';

type WorkspaceDraftInstallStatus =
  | 'not_requested'
  | 'pending'
  | 'approved'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'rejected';

export function attachSkillDraftInstallSummaries(
  skillDrafts: RuntimeWorkspaceDraftProjection[],
  receipts: SkillInstallReceipt[]
): RuntimeWorkspaceDraftProjection[] {
  return skillDrafts.map(draft => {
    const receipt = findWorkspaceDraftReceipt(draft.draftId, receipts);
    const install = receipt
      ? {
          receiptId: receipt.id,
          skillId: receipt.skillId,
          sourceId: receipt.sourceId,
          version: receipt.version,
          status: normalizeInstallStatus(receipt),
          phase: normalizeInstallPhase(receipt.phase),
          installedAt: receipt.installedAt,
          failureCode: receipt.failureCode
        }
      : undefined;

    return {
      ...draft,
      install,
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: draft.sourceTaskId,
        sourceEvidenceIds: draft.provenance?.sourceEvidenceIds,
        manifestId: receipt?.skillId ?? `workspace-draft-${draft.draftId}`,
        manifestSourceId: WORKSPACE_SKILL_DRAFT_SOURCE_ID
      },
      lifecycle: {
        draftStatus: draft.status,
        installStatus: receipt?.status,
        reusable: receipt?.status === 'installed',
        nextAction: resolveDraftNextAction(draft.status, receipt)
      }
    };
  });
}

function findWorkspaceDraftReceipt(draftId: string, receipts: SkillInstallReceipt[]): SkillInstallReceipt | undefined {
  const expectedSkillId = `workspace-draft-${draftId}`;
  return receipts
    .filter(
      receipt =>
        receipt.sourceId === WORKSPACE_SKILL_DRAFT_SOURCE_ID &&
        (receipt.sourceDraftId === draftId || receipt.skillId === expectedSkillId)
    )
    .sort((left, right) => (right.installedAt ?? '').localeCompare(left.installedAt ?? ''))[0];
}

function normalizeInstallStatus(receipt: SkillInstallReceipt): WorkspaceDraftInstallStatus {
  if (receipt.status === 'installed' || receipt.status === 'failed' || receipt.status === 'rejected') {
    return receipt.status;
  }
  if (receipt.phase === 'downloading' || receipt.phase === 'verifying' || receipt.phase === 'installing') {
    return 'installing';
  }
  if (receipt.status === 'pending' || receipt.status === 'approved') {
    return receipt.status;
  }
  return 'not_requested';
}

function normalizeInstallPhase(phase: SkillInstallReceipt['phase']) {
  if (
    phase === 'requested' ||
    phase === 'approved' ||
    phase === 'downloading' ||
    phase === 'verifying' ||
    phase === 'installing' ||
    phase === 'installed' ||
    phase === 'failed'
  ) {
    return phase;
  }
  return undefined;
}

function resolveDraftNextAction(draftStatus: RuntimeWorkspaceDraftProjection['status'], receipt?: SkillInstallReceipt) {
  if (receipt?.status === 'installed') {
    return 'ready_to_reuse';
  }
  if (receipt?.status === 'failed') {
    return 'retry_install';
  }
  if (receipt?.status === 'pending') {
    return 'approve_install';
  }
  if (draftStatus === 'active' || draftStatus === 'trusted') {
    return 'install_from_skill_lab';
  }
  if (draftStatus === 'draft' || draftStatus === 'shadow') {
    return 'review_draft';
  }
  return 'none';
}
