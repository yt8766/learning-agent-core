import type { LocalSkillSuggestionRecord, MemoryRecord, RuleRecord } from '@agent/core';
import { syncCapabilityGovernanceProfiles } from '@agent/runtime';

import { RuntimeCentersContext } from './runtime-centers.types';
import type { LearningCenterRecord } from './runtime-centers.records';
import {
  buildEvidenceCenter,
  buildLearningCenter,
  buildLearningCenterSummary
} from './runtime-learning-evidence-center';
import type { BuildLearningCenterInput } from './runtime-learning-evidence-center';
import { ingestLocalKnowledge } from '../knowledge/runtime-knowledge-store';
import { resolveLocalSkillSuggestionsWithTimeout } from './runtime-centers-query.helpers';
import { searchLocalSkillSuggestions } from '../skills/runtime-skill-sources.service';

type LocalSkillSuggestionsResult = {
  suggestions: LocalSkillSuggestionRecord[];
  gapSummary?: string;
  profile?: string;
  usedInstalledSkills?: string[];
};

export class RuntimeCentersLearningQueryService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

  getLearningCenter(): Promise<LearningCenterRecord> {
    return this.buildLearningCenterRecord('full');
  }

  getLearningCenterSummary(): Promise<LearningCenterRecord> {
    return this.buildLearningCenterRecord('summary');
  }

  getEvidenceCenter() {
    const ctx = this.ctx();
    const tasks = ctx.orchestrator.listTasks();
    const jobs = ctx.orchestrator.listLearningJobs();
    return Promise.all([ctx.wenyuanFacade.getOverview(), ingestLocalKnowledge(ctx.settings)]).then(
      ([wenyuanOverview, knowledgeOverview]) =>
        buildEvidenceCenter({
          tasks,
          jobs,
          getCheckpoint: (sessionId: string) => ctx.wenyuanFacade.getCheckpoint(sessionId),
          wenyuanOverview,
          knowledgeOverview
        })
    );
  }

  private buildLearningCenterRecord(mode: 'full' | 'summary'): Promise<LearningCenterRecord> {
    const ctx = this.ctx();
    const rawTasks = ctx.orchestrator.listTasks();
    const tasks = normalizeLearningCenterTasks(rawTasks);
    const jobs = normalizeLearningCenterJobs(ctx.orchestrator.listLearningJobs());
    const learningQueue = ctx.orchestrator.listLearningQueue?.() ?? [];
    const capabilityGovernanceSyncPromise = syncCapabilityGovernanceProfiles(ctx.runtimeStateRepository, rawTasks);
    const crossCheckEvidencePromise = ctx.wenyuanFacade.listCrossCheckEvidence();
    const memoryStatsPromise = ctx.wenyuanFacade.listMemories().then((items: MemoryRecord[]) => {
      const invalidated = items.filter(item => item.status === 'invalidated').length;
      const quarantinedItems = items
        .filter(item => item.quarantined)
        .sort(
          (left, right) =>
            new Date(
              right.quarantinedAt ?? right.lastVerifiedAt ?? right.lastUsedAt ?? right.createdAt ?? 0
            ).getTime() -
            new Date(left.quarantinedAt ?? left.lastVerifiedAt ?? left.lastUsedAt ?? left.createdAt ?? 0).getTime()
        );
      return {
        invalidated,
        quarantined: quarantinedItems.length,
        recentQuarantined: quarantinedItems.slice(0, 8).map(item => ({
          id: item.id,
          summary: item.summary,
          quarantineReason: item.quarantineReason,
          quarantineCategory: item.quarantineCategory,
          quarantineReasonDetail: item.quarantineReasonDetail,
          quarantineRestoreSuggestion: item.quarantineRestoreSuggestion,
          quarantinedAt: item.quarantinedAt
        }))
      };
    });
    const invalidatedRulesPromise = ctx.ruleRepository
      .list()
      .then((items: RuleRecord[]) => items.filter(item => item.status === 'invalidated').length);
    const input: BuildLearningCenterInput = {
      tasks,
      jobs,
      wenyuanOverviewPromise: mode === 'full' ? ctx.wenyuanFacade.getOverview() : Promise.resolve(undefined),
      knowledgeOverviewPromise: mode === 'full' ? ingestLocalKnowledge(ctx.settings) : Promise.resolve(undefined),
      learningQueue,
      memoryStatsPromise,
      invalidatedRulesPromise,
      crossCheckEvidencePromise: mode === 'full' ? crossCheckEvidencePromise : Promise.resolve([]),
      governanceSnapshotPromise:
        mode === 'full'
          ? capabilityGovernanceSyncPromise.then(() => ctx.runtimeStateRepository.load())
          : Promise.resolve(undefined),
      resolutionCandidatesPromise: ctx.wenyuanFacade.listResolutionCandidates?.() ?? Promise.resolve([]),
      resolveLocalSkillSuggestions:
        mode === 'full'
          ? task =>
              resolveLocalSkillSuggestionsWithTimeout(() =>
                searchLocalSkillSuggestions(ctx.getSkillSourcesContext(), task.goal, {
                  usedInstalledSkills: task.usedInstalledSkills,
                  limit: 3
                })
              )
          : async (): Promise<LocalSkillSuggestionsResult> => ({
              suggestions: [],
              gapSummary: 'shell-summary-skipped'
            })
    };
    return (
      mode === 'full' ? buildLearningCenter(input) : buildLearningCenterSummary(input)
    ) as Promise<LearningCenterRecord>;
  }

  private ctx() {
    return this.getContext();
  }
}

function normalizeLearningCenterTasks(tasks: unknown[]): BuildLearningCenterInput['tasks'] {
  return tasks.map(task => {
    if (!isRecord(task)) {
      return {} as BuildLearningCenterInput['tasks'][number];
    }

    const learningEvaluation = isRecord(task.learningEvaluation)
      ? {
          ...task.learningEvaluation,
          confidence: toOptionalNumber(task.learningEvaluation.confidence)
        }
      : task.learningEvaluation;

    return {
      ...task,
      learningEvaluation
    } as BuildLearningCenterInput['tasks'][number];
  });
}

function normalizeLearningCenterJobs(jobs: unknown[]): BuildLearningCenterInput['jobs'] {
  return jobs.map(job => {
    if (!isRecord(job)) {
      return {} as BuildLearningCenterInput['jobs'][number];
    }

    const learningEvaluation = isRecord(job.learningEvaluation)
      ? {
          ...job.learningEvaluation,
          confidence: toOptionalNumber(job.learningEvaluation.confidence),
          candidateReasons: Array.isArray(job.learningEvaluation.candidateReasons)
            ? job.learningEvaluation.candidateReasons.filter((item): item is string => typeof item === 'string')
            : undefined,
          skippedReasons: Array.isArray(job.learningEvaluation.skippedReasons)
            ? job.learningEvaluation.skippedReasons.filter((item): item is string => typeof item === 'string')
            : undefined,
          expertiseSignals: Array.isArray(job.learningEvaluation.expertiseSignals)
            ? job.learningEvaluation.expertiseSignals.filter((item): item is string => typeof item === 'string')
            : undefined
        }
      : undefined;

    const persistedMemoryIds = Array.isArray(job.persistedMemoryIds)
      ? job.persistedMemoryIds.filter((item): item is string => typeof item === 'string')
      : undefined;

    return {
      ...job,
      sourceType: typeof job.sourceType === 'string' ? job.sourceType : undefined,
      persistedMemoryIds,
      conflictDetected: typeof job.conflictDetected === 'boolean' ? job.conflictDetected : undefined,
      updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : undefined,
      learningEvaluation
    } as BuildLearningCenterInput['jobs'][number];
  });
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
