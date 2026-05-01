import { type AgentSkillReuseRecord } from '@agent/core';

import type { WorkspaceCenterRecord } from './runtime-centers.records';
import { isCitationEvidenceSource, normalizeInstalledSkillId } from '@agent/knowledge';

type WorkspaceEvidence = WorkspaceCenterRecord['evidence'][number];
type WorkspaceLearningSummary = WorkspaceCenterRecord['learningSummaries'][number];
type WorkspaceReuseBadge = WorkspaceCenterRecord['reuseBadges'][number];
type WorkspaceCapabilityGap = WorkspaceCenterRecord['capabilityGaps'][number];
type WorkspaceCurrentTask = NonNullable<WorkspaceCenterRecord['currentTask']>;
type WorkspaceSkillDraft = WorkspaceCenterRecord['skillDrafts'][number];

interface WorkspaceEvidenceSourceLike {
  id: string;
  sourceType: string;
  sourceUrl?: string;
  summary?: string;
  trustClass?: string;
}

interface WorkspaceLearningEvaluationLike {
  confidence?: string;
  rationale?: string;
  notes?: string[];
  recommendedCandidateIds?: string[];
  autoConfirmCandidateIds?: string[];
}

interface WorkspaceSkillSearchLike {
  capabilityGapDetected?: boolean;
  query?: string;
  gapSummary?: string;
  mcpRecommendation?: {
    summary?: string;
  };
  suggestions?: Array<{
    id?: string;
    displayName?: string;
    summary?: string;
  }>;
}

export interface WorkspaceTaskProjectionLike {
  id: string;
  goal?: string;
  status?: string;
  sessionId?: string;
  executionMode?: string;
  pendingApproval?: unknown;
  activeInterrupt?: {
    interactionKind?: string;
  };
  externalSources?: WorkspaceEvidenceSourceLike[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  usedInstalledSkills?: string[];
  learningEvaluation?: WorkspaceLearningEvaluationLike;
  skillSearch?: WorkspaceSkillSearchLike;
  result?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface RuntimeWorkspaceTaskProjection {
  currentTask?: WorkspaceCurrentTask;
  evidence: WorkspaceEvidence[];
  reuseBadges: WorkspaceReuseBadge[];
  capabilityGaps: WorkspaceCapabilityGap[];
  learningSummaries: WorkspaceLearningSummary[];
}

const MAX_WORKSPACE_TASKS = 5;
const MAX_WORKSPACE_EVIDENCE = 8;
const MAX_WORKSPACE_REUSE_BADGES = 12;

export function buildRuntimeWorkspaceTaskProjection(
  tasks: WorkspaceTaskProjectionLike[],
  skillDrafts: WorkspaceSkillDraft[],
  skillReuseRecords: AgentSkillReuseRecord[] = []
): RuntimeWorkspaceTaskProjection {
  const recentTasks = sortRecentTasks(tasks).slice(0, MAX_WORKSPACE_TASKS);
  const currentTaskSource = recentTasks.find(task => task.status === 'running') ?? recentTasks[0];

  return {
    currentTask: currentTaskSource ? buildCurrentTask(currentTaskSource) : undefined,
    evidence: buildWorkspaceEvidence(recentTasks),
    reuseBadges: buildWorkspaceReuseBadges(recentTasks, skillReuseRecords),
    capabilityGaps: buildWorkspaceCapabilityGaps(recentTasks),
    learningSummaries: buildWorkspaceLearningSummaries(recentTasks, skillDrafts)
  };
}

function sortRecentTasks(tasks: WorkspaceTaskProjectionLike[]): WorkspaceTaskProjectionLike[] {
  return [...tasks].sort((left, right) => timestampOf(right) - timestampOf(left));
}

function timestampOf(task: WorkspaceTaskProjectionLike): number {
  return Date.parse(task.updatedAt ?? task.createdAt ?? '') || 0;
}

function buildCurrentTask(task: WorkspaceTaskProjectionLike): WorkspaceCurrentTask {
  return compactRecord({
    taskId: task.id,
    title: task.goal,
    status: task.status ?? 'unknown',
    executionMode: normalizeExecutionMode(task.executionMode),
    interactionKind: normalizeInteractionKind(task)
  });
}

function buildWorkspaceEvidence(tasks: WorkspaceTaskProjectionLike[]): WorkspaceEvidence[] {
  const evidence = new Map<string, WorkspaceEvidence>();

  for (const task of tasks) {
    for (const source of task.externalSources ?? []) {
      if (
        !isCitationEvidenceSource({
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          trustClass: source.trustClass ?? 'unknown'
        })
      ) {
        continue;
      }
      if (evidence.size >= MAX_WORKSPACE_EVIDENCE) {
        return Array.from(evidence.values());
      }

      evidence.set(
        source.id,
        compactRecord({
          evidenceId: source.id,
          title: source.sourceUrl ?? source.sourceType,
          summary: source.summary,
          sourceKind: source.sourceType,
          citationId: source.sourceUrl
        })
      );
    }
  }

  return Array.from(evidence.values());
}

function buildWorkspaceReuseBadges(
  tasks: WorkspaceTaskProjectionLike[],
  skillReuseRecords: AgentSkillReuseRecord[]
): WorkspaceReuseBadge[] {
  const badges = new Map<string, WorkspaceReuseBadge>();

  addReuseBadges(
    badges,
    'skill',
    skillReuseRecords.map(record => record.skillId)
  );
  for (const task of tasks) {
    addReuseBadges(badges, 'memory', task.reusedMemories);
    addReuseBadges(badges, 'rule', task.reusedRules);
    addReuseBadges(badges, 'skill', task.reusedSkills);
    addReuseBadges(badges, 'skill', task.usedInstalledSkills);
    if (badges.size >= MAX_WORKSPACE_REUSE_BADGES) {
      break;
    }
  }

  return Array.from(badges.values()).slice(0, MAX_WORKSPACE_REUSE_BADGES);
}

function addReuseBadges(
  badges: Map<string, WorkspaceReuseBadge>,
  kind: WorkspaceReuseBadge['kind'],
  ids?: string[]
): void {
  for (const id of ids ?? []) {
    const normalizedId = kind === 'skill' ? normalizeInstalledSkillId(id) : id;
    const key = `${kind}:${normalizedId}`;
    if (!badges.has(key)) {
      badges.set(key, {
        kind,
        id: normalizedId,
        label: normalizedId
      });
    }
  }
}

function buildWorkspaceCapabilityGaps(tasks: WorkspaceTaskProjectionLike[]): WorkspaceCapabilityGap[] {
  return tasks
    .filter(task => task.skillSearch?.capabilityGapDetected)
    .map(
      (task): WorkspaceCapabilityGap =>
        compactRecord({
          capabilityId: task.skillSearch?.query,
          label:
            task.skillSearch?.gapSummary ??
            task.skillSearch?.mcpRecommendation?.summary ??
            task.skillSearch?.suggestions?.[0]?.displayName ??
            'Capability gap detected',
          severity: 'medium',
          suggestedAction: task.skillSearch?.suggestions?.[0]?.summary
        })
    );
}

function buildWorkspaceLearningSummaries(
  tasks: WorkspaceTaskProjectionLike[],
  skillDrafts: WorkspaceSkillDraft[]
): WorkspaceLearningSummary[] {
  return tasks
    .filter(
      task =>
        task.learningEvaluation ||
        (task.externalSources?.length ?? 0) > 0 ||
        (task.reusedMemories?.length ?? 0) > 0 ||
        (task.reusedRules?.length ?? 0) > 0 ||
        (task.reusedSkills?.length ?? 0) > 0 ||
        (task.usedInstalledSkills?.length ?? 0) > 0
    )
    .map((task): WorkspaceLearningSummary => {
      const learningEvaluation = task.learningEvaluation;
      const taskDrafts = skillDrafts.filter(draft => draft.sourceTaskId === task.id);

      return compactRecord({
        taskId: task.id,
        sessionId: task.sessionId,
        generatedAt: task.updatedAt ?? task.createdAt ?? new Date(0).toISOString(),
        summary: learningEvaluation?.rationale ?? learningEvaluation?.notes?.[0] ?? task.result ?? task.goal ?? task.id,
        outcome: normalizeOutcome(task.status),
        evidenceRefs: (task.externalSources ?? []).map(source =>
          compactRecord({
            evidenceId: source.id,
            title: source.summary,
            sourceKind: source.sourceType
          })
        ),
        memoryHints: (task.reusedMemories ?? []).map(id => ({ id, summary: id })),
        ruleHints: (task.reusedRules ?? []).map(id => ({ id, summary: id })),
        skillDraftRefs: taskDrafts.map(draft => ({
          draftId: draft.draftId,
          status: draft.status
        })),
        capabilityGaps: buildWorkspaceCapabilityGaps([task])
      });
    });
}

function normalizeExecutionMode(value?: string): WorkspaceCurrentTask['executionMode'] {
  if (value === 'plan' || value === 'execute' || value === 'imperial_direct') {
    return value;
  }

  return undefined;
}

function normalizeInteractionKind(task: WorkspaceTaskProjectionLike): WorkspaceCurrentTask['interactionKind'] {
  if (task.activeInterrupt?.interactionKind === 'approval' || task.pendingApproval) {
    return 'approval';
  }
  if (task.activeInterrupt?.interactionKind === 'plan-question') {
    return 'plan-question';
  }
  if (task.activeInterrupt?.interactionKind === 'supplemental-input') {
    return 'supplemental-input';
  }

  return undefined;
}

function normalizeOutcome(status?: string): WorkspaceLearningSummary['outcome'] {
  if (status === 'completed') {
    return 'succeeded';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'canceled' || status === 'cancelled') {
    return 'canceled';
  }
  if (status) {
    return 'partial';
  }

  return undefined;
}

function compactRecord<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}
