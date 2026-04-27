import {
  attachSkillDraftEvidenceProvenance,
  countSkillDraftStatuses,
  toCapabilityGapProjection,
  toCurrentTaskProjection,
  toEvidenceProjection,
  toLearningSummaryProjection,
  toReuseBadgeProjection,
  toSkillReuseRecordProjection,
  toSkillDraftProjection
} from './runtime-workspace-center.helpers';
import type { BuildRuntimeWorkspaceCenterInput, RuntimeWorkspaceCenterRecord } from './runtime-workspace-center.types';

export function buildRuntimeWorkspaceCenter(input: BuildRuntimeWorkspaceCenterInput): RuntimeWorkspaceCenterRecord {
  const evidence = (input.workspace.evidence ?? []).map(toEvidenceProjection);
  const skillDrafts = attachSkillDraftEvidenceProvenance(
    (input.skillDrafts ?? []).map(toSkillDraftProjection),
    evidence
  );
  const learningSummaries = (input.learningSummaries ?? []).map(toLearningSummaryProjection);
  const reuseRecords = (input.reuseRecords ?? []).map(toSkillReuseRecordProjection);
  const learningSummary = input.workspace.learningSummary
    ? toLearningSummaryProjection(input.workspace.learningSummary)
    : learningSummaries[0];
  const taskIds = new Set(
    [
      input.workspace.taskId,
      input.workspace.currentTask?.taskId,
      ...learningSummaries.map(summary => summary.taskId)
    ].filter(Boolean)
  );

  return {
    workspaceId: input.workspace.workspaceId,
    sessionId: input.workspace.sessionId,
    taskId: input.workspace.taskId,
    status: input.workspace.status,
    generatedAt: input.workspace.generatedAt,
    updatedAt: input.workspace.updatedAt,
    currentTask: input.workspace.currentTask ? toCurrentTaskProjection(input.workspace.currentTask) : undefined,
    learningSummary,
    learningSummaries,
    skillDrafts,
    reuseRecords,
    evidence,
    reuseBadges: (input.workspace.reuseBadges ?? []).map(toReuseBadgeProjection),
    capabilityGaps: (input.workspace.capabilityGaps ?? []).map(toCapabilityGapProjection),
    totals: {
      tasks: taskIds.size,
      learningSummaries: learningSummaries.length,
      skillDrafts: skillDrafts.length,
      pendingSkillDrafts: skillDrafts.filter(draft => draft.status === 'draft' || draft.status === 'shadow').length,
      reuseRecords: reuseRecords.length
    },
    skillDraftStatusCounts: countSkillDraftStatuses(skillDrafts)
  };
}
