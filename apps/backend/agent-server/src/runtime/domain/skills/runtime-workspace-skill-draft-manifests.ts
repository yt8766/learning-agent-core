import type { SkillManifestRecord } from '@agent/core';
import type { SkillDraftRecord } from '@agent/skill';

export const WORKSPACE_SKILL_DRAFT_SOURCE_ID = 'workspace-skill-drafts';

export function buildWorkspaceSkillDraftManifests(drafts: SkillDraftRecord[]): SkillManifestRecord[] {
  return drafts.filter(isInstallableDraft).map(buildWorkspaceSkillDraftManifest);
}

function buildWorkspaceSkillDraftManifest(draft: SkillDraftRecord): SkillManifestRecord {
  return {
    id: `workspace-draft-${sanitizeManifestId(draft.id)}`,
    name: draft.title,
    version: buildManifestVersion(draft.updatedAt),
    description: draft.description ?? draft.title,
    publisher: 'workspace',
    sourceId: WORKSPACE_SKILL_DRAFT_SOURCE_ID,
    requiredCapabilities: [...draft.requiredTools],
    requiredConnectors: [...draft.requiredConnectors],
    allowedTools: [...draft.requiredTools],
    approvalPolicy: draft.riskLevel === 'critical' || draft.riskLevel === 'high' ? 'all-actions' : 'high-risk-only',
    riskLevel: draft.riskLevel,
    entry: `workspace-draft:${draft.id}`,
    summary: draft.description ?? draft.bodyMarkdown.slice(0, 240),
    triggers: [...draft.triggerHints],
    metadata: {
      draftId: draft.id,
      sourceTaskId: draft.sourceTaskId,
      confidence: String(draft.confidence),
      reuseCount: String(draft.reuseStats.count)
    }
  };
}

function isInstallableDraft(draft: SkillDraftRecord): boolean {
  return draft.status === 'active' || draft.status === 'trusted';
}

function sanitizeManifestId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildManifestVersion(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) {
    return 'draft';
  }

  return new Date(timestamp)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .replace(/\.\d{3}Z$/, '');
}
