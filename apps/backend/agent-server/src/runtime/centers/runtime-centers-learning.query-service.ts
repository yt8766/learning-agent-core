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
import { resolveLocalSkillSuggestionsWithTimeout } from '../domain/observability/runtime-observability-filters';
import { ingestLocalKnowledge } from '../knowledge/runtime-knowledge-store';
import { searchLocalSkillSuggestions } from '../skills/runtime-skill-sources.service';
import {
  normalizeLearningCenterJobs,
  normalizeLearningCenterTasks
} from '../domain/learning/runtime-learning-center-normalization';
import { buildLearningMemoryStats } from '../domain/learning/runtime-learning-memory-stats';
import { countInvalidatedRules } from '../domain/learning/runtime-learning-rule-stats';

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
    const memoryStatsPromise = ctx.wenyuanFacade
      .listMemories()
      .then((items: MemoryRecord[]) => buildLearningMemoryStats(items));
    const invalidatedRulesPromise = ctx.ruleRepository
      .list()
      .then((items: RuleRecord[]) => countInvalidatedRules(items));
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
