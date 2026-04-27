import type { AgentSkillReuseRecord } from '@agent/core';

import type {
  RuntimeWorkspaceCapabilityGap,
  RuntimeWorkspaceCurrentTaskRecord,
  RuntimeWorkspaceEvidenceSummary,
  RuntimeWorkspaceLearningEvidenceRef,
  RuntimeWorkspaceLearningHint,
  RuntimeWorkspaceLearningSummaryRecord,
  RuntimeWorkspaceReuseBadge,
  RuntimeWorkspaceSkillDraftInstallSummary,
  RuntimeWorkspaceSkillDraftLifecycleSummary,
  RuntimeWorkspaceSkillDraftProvenanceSummary,
  RuntimeWorkspaceSkillDraftRecord,
  RuntimeWorkspaceSkillDraftRef,
  SkillDraftStatus
} from './runtime-workspace-center.types';

export const SKILL_DRAFT_STATUSES: SkillDraftStatus[] = ['draft', 'shadow', 'active', 'trusted', 'rejected', 'retired'];

export function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

export function toCurrentTaskProjection(task: RuntimeWorkspaceCurrentTaskRecord): RuntimeWorkspaceCurrentTaskRecord {
  return compactRecord({
    taskId: task.taskId,
    title: task.title,
    status: task.status,
    executionMode: task.executionMode,
    interactionKind: task.interactionKind
  });
}

export function toEvidenceProjection(item: RuntimeWorkspaceEvidenceSummary): RuntimeWorkspaceEvidenceSummary {
  return compactRecord({
    evidenceId: item.evidenceId,
    title: item.title,
    summary: item.summary,
    sourceKind: item.sourceKind,
    citationId: item.citationId
  });
}

export function toReuseBadgeProjection(item: RuntimeWorkspaceReuseBadge): RuntimeWorkspaceReuseBadge {
  return compactRecord({
    kind: item.kind,
    id: item.id,
    label: item.label,
    confidence: item.confidence
  });
}

export function toSkillReuseRecordProjection(item: AgentSkillReuseRecord): AgentSkillReuseRecord {
  return compactRecord({
    id: item.id,
    workspaceId: item.workspaceId,
    skillId: item.skillId,
    reusedBy: {
      id: item.reusedBy.id,
      label: item.reusedBy.label,
      kind: item.reusedBy.kind
    },
    taskId: item.taskId,
    sourceDraftId: item.sourceDraftId,
    outcome: item.outcome,
    evidenceRefs: item.evidenceRefs ?? [],
    reusedAt: item.reusedAt
  });
}

export function toCapabilityGapProjection(item: RuntimeWorkspaceCapabilityGap): RuntimeWorkspaceCapabilityGap {
  return compactRecord({
    capabilityId: item.capabilityId,
    label: item.label,
    severity: item.severity,
    suggestedAction: item.suggestedAction
  });
}

export function toLearningEvidenceRefProjection(
  item: RuntimeWorkspaceLearningEvidenceRef
): RuntimeWorkspaceLearningEvidenceRef {
  return compactRecord({
    evidenceId: item.evidenceId,
    title: item.title,
    sourceKind: item.sourceKind
  });
}

export function toLearningHintProjection(item: RuntimeWorkspaceLearningHint): RuntimeWorkspaceLearningHint {
  return compactRecord({
    id: item.id,
    summary: item.summary,
    confidence: item.confidence
  });
}

export function toSkillDraftRefProjection(item: RuntimeWorkspaceSkillDraftRef): RuntimeWorkspaceSkillDraftRef {
  return compactRecord({
    draftId: item.draftId,
    status: item.status
  });
}

export function toLearningSummaryProjection(
  item: RuntimeWorkspaceLearningSummaryRecord
): RuntimeWorkspaceLearningSummaryRecord {
  return compactRecord({
    taskId: item.taskId,
    sessionId: item.sessionId,
    generatedAt: item.generatedAt,
    summary: item.summary,
    outcome: item.outcome,
    evidenceRefs: (item.evidenceRefs ?? []).map(toLearningEvidenceRefProjection),
    memoryHints: (item.memoryHints ?? []).map(toLearningHintProjection),
    ruleHints: (item.ruleHints ?? []).map(toLearningHintProjection),
    skillDraftRefs: (item.skillDraftRefs ?? []).map(toSkillDraftRefProjection),
    capabilityGaps: (item.capabilityGaps ?? []).map(toCapabilityGapProjection)
  });
}

export function toSkillDraftProjection(item: RuntimeWorkspaceSkillDraftRecord): RuntimeWorkspaceSkillDraftRecord {
  return compactRecord({
    draftId: item.draftId,
    status: item.status,
    title: item.title,
    summary: item.summary,
    sourceTaskId: item.sourceTaskId,
    sessionId: item.sessionId,
    confidence: item.confidence,
    riskLevel: item.riskLevel,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    decidedAt: item.decidedAt,
    decidedBy: item.decidedBy,
    install: item.install ? toSkillDraftInstallProjection(item.install) : undefined,
    provenance: item.provenance ? toSkillDraftProvenanceProjection(item.provenance) : undefined,
    lifecycle: item.lifecycle ? toSkillDraftLifecycleProjection(item.lifecycle) : undefined
  });
}

export function attachSkillDraftEvidenceProvenance(
  skillDrafts: RuntimeWorkspaceSkillDraftRecord[],
  evidence: RuntimeWorkspaceEvidenceSummary[]
): RuntimeWorkspaceSkillDraftRecord[] {
  const evidenceById = new Map(evidence.map(item => [item.evidenceId, item]));

  return skillDrafts.map(draft => {
    const sourceEvidenceIds = draft.provenance?.sourceEvidenceIds;
    if (!draft.provenance || !sourceEvidenceIds || sourceEvidenceIds.length === 0) {
      return draft;
    }

    return {
      ...draft,
      provenance: compactRecord({
        ...draft.provenance,
        evidenceCount: sourceEvidenceIds.length,
        evidenceRefs: sourceEvidenceIds
          .map(evidenceId => evidenceById.get(evidenceId))
          .filter((item): item is RuntimeWorkspaceEvidenceSummary => Boolean(item))
      })
    };
  });
}

function toSkillDraftInstallProjection(
  item: RuntimeWorkspaceSkillDraftInstallSummary
): RuntimeWorkspaceSkillDraftInstallSummary {
  return compactRecord({
    receiptId: item.receiptId,
    skillId: item.skillId,
    sourceId: item.sourceId,
    version: item.version,
    status: item.status,
    phase: item.phase,
    installedAt: item.installedAt,
    failureCode: item.failureCode
  });
}

function toSkillDraftProvenanceProjection(
  item: RuntimeWorkspaceSkillDraftProvenanceSummary
): RuntimeWorkspaceSkillDraftProvenanceSummary {
  return compactRecord({
    sourceKind: item.sourceKind,
    sourceTaskId: item.sourceTaskId,
    sourceEvidenceIds: item.sourceEvidenceIds,
    evidenceCount: item.evidenceCount,
    evidenceRefs: item.evidenceRefs?.map(toEvidenceProjection),
    manifestId: item.manifestId,
    manifestSourceId: item.manifestSourceId
  });
}

function toSkillDraftLifecycleProjection(
  item: RuntimeWorkspaceSkillDraftLifecycleSummary
): RuntimeWorkspaceSkillDraftLifecycleSummary {
  return compactRecord({
    draftStatus: item.draftStatus,
    installStatus: item.installStatus,
    reusable: item.reusable,
    nextAction: item.nextAction
  });
}

export function countSkillDraftStatuses(
  skillDrafts: RuntimeWorkspaceSkillDraftRecord[]
): Record<SkillDraftStatus, number> {
  const counts = Object.fromEntries(SKILL_DRAFT_STATUSES.map(status => [status, 0])) as Record<
    SkillDraftStatus,
    number
  >;
  for (const draft of skillDrafts) {
    counts[draft.status] += 1;
  }
  return counts;
}
