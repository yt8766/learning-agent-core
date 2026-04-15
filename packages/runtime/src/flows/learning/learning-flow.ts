import { loadSettings } from '@agent/config';
import { z } from 'zod/v4';
import { MemoryRepository, RuleRepository, MemorySearchService } from '@agent/memory';
import { type LlmProvider, generateObjectWithRetry } from '@agent/adapters';
import {
  EvaluationResult,
  LearningEvaluationRecord,
  LearningJob,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';

import { autoPersistResearchMemory, evaluateResearchJob } from './learning-flow-research';
import {
  ensureCandidates,
  isDiagnosisTask,
  mergeEvidence,
  normalizeInstalledSkillId,
  prepareTaskLearning,
  shouldExtractSkillForTask
} from './learning-flow-task';

interface LearningFlowDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  ruleRepository: RuleRepository;
  skillRegistry: SkillRegistry;
  llmProvider?: LlmProvider;
  thinking?: boolean;
  settings?: ReturnType<typeof loadSettings>;
  localSkillSuggestionResolver?: (task: TaskRecord) => Promise<TaskRecord['skillSearch'] | undefined>;
}

export class LearningFlow {
  private readonly settings: ReturnType<typeof loadSettings>;

  constructor(private readonly dependencies: LearningFlowDependencies) {
    this.settings = dependencies.settings ?? loadSettings();
  }

  async hydrateTaskKnowledge(task: TaskRecord, limit = 5): Promise<void> {
    const query = task.goal?.trim() || task.result?.trim();
    if (!query || !this.dependencies.memorySearchService) {
      return;
    }

    const related = await this.dependencies.memorySearchService.search(query, limit);
    task.reusedMemories = Array.from(
      new Set([...(task.reusedMemories ?? []), ...related.memories.map(memory => memory.id)])
    );
    task.reusedRules = Array.from(new Set([...(task.reusedRules ?? []), ...related.rules.map(rule => rule.id)]));
  }

  evaluateResearchJob(job: LearningJob): LearningEvaluationRecord {
    return evaluateResearchJob(job);
  }

  async autoPersistResearchMemory(
    job: LearningJob,
    policy: 'manual' | 'high-confidence' = 'manual'
  ): Promise<string[]> {
    const evaluation = job.learningEvaluation ?? this.evaluateResearchJob(job);
    job.learningEvaluation = evaluation;
    return autoPersistResearchMemory(this.dependencies.memoryRepository, job, evaluation, policy);
  }

  prepareTaskLearning(
    task: TaskRecord,
    evaluation?: EvaluationResult,
    review?: ReviewRecord
  ): LearningEvaluationRecord | undefined {
    return prepareTaskLearning(task, evaluation, review);
  }

  async refineTaskLearning(
    task: TaskRecord,
    evaluation?: EvaluationResult,
    review?: ReviewRecord
  ): Promise<LearningEvaluationRecord | undefined> {
    const baseline = task.learningEvaluation ?? this.prepareTaskLearning(task, evaluation, review);
    if (!baseline) {
      return baseline;
    }
    await this.refreshSkillSearchIfNeeded(task, baseline);
    if (!this.dependencies.llmProvider?.isConfigured()) {
      return task.learningEvaluation;
    }

    const schema = z.object({
      shouldLearn: z.boolean(),
      shouldSearchSkills: z.boolean(),
      suggestedCandidateTypes: z
        .array(z.enum(['memory', 'rule', 'skill']))
        .min(1)
        .max(3),
      rationale: z.string(),
      notes: z.array(z.string()).max(4),
      autoConfirm: z.boolean()
    });

    try {
      const decision = await generateObjectWithRetry({
        llm: this.dependencies.llmProvider,
        contractName: 'learning-decision',
        contractVersion: '1.0.0',
        messages: [
          {
            role: 'system',
            content:
              '你负责多 Agent 系统的学习裁决。请根据任务结果、评审、能力缺口和技能复用情况，判断这一轮是否值得沉淀为长期知识，并明确应该优先沉淀 memory、rule 还是 skill。若存在明显能力缺口，应优先考虑 shouldSearchSkills=true。'
          },
          {
            role: 'user',
            content: JSON.stringify({
              goal: task.goal,
              result: task.result,
              review,
              evaluation,
              baseline,
              skillSearch: task.skillSearch,
              usedInstalledSkills: task.usedInstalledSkills,
              usedCompanyWorkers: task.usedCompanyWorkers,
              reusedMemories: task.reusedMemories,
              reusedRules: task.reusedRules,
              reusedSkills: task.reusedSkills
            })
          }
        ],
        schema,
        options: {
          role: 'manager',
          taskId: task.id,
          thinking: this.dependencies.thinking,
          temperature: 0.1
        }
      });

      task.learningEvaluation = {
        ...baseline,
        shouldLearn: decision.shouldLearn,
        shouldSearchSkills: decision.shouldSearchSkills || baseline.shouldSearchSkills,
        suggestedCandidateTypes: decision.suggestedCandidateTypes,
        rationale: decision.rationale,
        notes: Array.from(new Set([decision.rationale, ...decision.notes, ...baseline.notes])).slice(0, 8),
        autoConfirmCandidateIds: decision.autoConfirm ? baseline.autoConfirmCandidateIds : [],
        expertiseSignals: Array.from(
          new Set([
            ...(baseline.expertiseSignals ?? []),
            this.settings.policy.suggestionPolicy.expertAdviceDefault ? 'domain-expert' : 'generalist'
          ])
        )
      };
      return task.learningEvaluation;
    } catch {
      return baseline;
    }
  }

  ensureCandidates(task: TaskRecord) {
    return ensureCandidates(task);
  }

  async confirmCandidates(task: TaskRecord, candidateIds?: string[]) {
    if (!task.learningCandidates?.length) {
      return [];
    }

    const selected = new Set(candidateIds ?? task.learningCandidates.map(candidate => candidate.id));
    for (const candidate of task.learningCandidates) {
      if (!selected.has(candidate.id)) {
        continue;
      }

      if (candidate.type === 'memory') {
        const memory = candidate.payload as any;
        const conflicts = await this.dependencies.memoryRepository.search(memory.summary, 3);
        const matchedConflicts = conflicts.filter(
          record => record.id !== memory.id && hasMeaningfulMemoryConflict(record, memory)
        );
        const preferredConflict = selectPreferredConflict(memory, matchedConflicts);
        const conflictIds = matchedConflicts.map(record => record.id);
        if (conflictIds.length > 0) {
          const closeConflict =
            preferredConflict && Math.abs((preferredConflict.effectiveness ?? 0) - (memory.effectiveness ?? 0)) < 0.1;
          const highImpactConflict =
            closeConflict &&
            ((memory.effectiveness ?? 0) >= 0.8 || matchedConflicts.some(record => (record.effectiveness ?? 0) >= 0.8));
          task.learningEvaluation = {
            ...(task.learningEvaluation ?? {
              score: 0,
              confidence: 'low',
              notes: [],
              recommendedCandidateIds: [],
              autoConfirmCandidateIds: [],
              sourceSummary: {
                externalSourceCount: 0,
                internalSourceCount: 0,
                reusedMemoryCount: 0,
                reusedRuleCount: 0,
                reusedSkillCount: 0
              }
            }),
            conflictDetected: true,
            conflictTargets: Array.from(new Set([...(task.learningEvaluation?.conflictTargets ?? []), ...conflictIds])),
            skippedReasons: Array.from(
              new Set([
                ...(task.learningEvaluation?.skippedReasons ?? []),
                closeConflict
                  ? `memory:${candidate.id} pending lightweight review due to close effectiveness conflicts: ${conflictIds.join(', ')}`
                  : `memory:${candidate.id} skipped due to conflicts: ${conflictIds.join(', ')}`
              ])
            ),
            governanceWarnings: Array.from(
              new Set([
                ...(task.learningEvaluation?.governanceWarnings ?? []),
                closeConflict
                  ? highImpactConflict
                    ? `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 效果分接近且影响较高，需升级为 plan-question 再决定。`
                    : `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 效果分接近，需交刑部做轻量裁决后再写入。`
                  : `长期记忆候选 ${candidate.id} 与已有记录 ${conflictIds.join(', ')} 冲突，已跳过自动写入。`
              ])
            )
          };
          if (
            preferredConflict &&
            !closeConflict &&
            (preferredConflict.effectiveness ?? 0) >= (memory.effectiveness ?? 0)
          ) {
            continue;
          }
          if (closeConflict) {
            continue;
          }
        }
        if (preferredConflict && (preferredConflict.effectiveness ?? 0) > (memory.effectiveness ?? 0)) {
          continue;
        }
        await this.dependencies.memoryRepository.append(memory as never);
      } else if (candidate.type === 'rule') {
        await this.dependencies.ruleRepository.append(candidate.payload as never);
      } else if (candidate.type === 'skill') {
        await this.dependencies.skillRegistry.publishToLab(candidate.payload as never);
      }
    }

    task.learningCandidates = task.learningCandidates.map(candidate =>
      selected.has(candidate.id)
        ? { ...candidate, status: 'confirmed', confirmedAt: new Date().toISOString() }
        : candidate
    );

    return [...selected];
  }

  async persistReviewArtifacts(
    task: TaskRecord,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string,
    builders: {
      buildMemoryRecord: (
        taskId: string,
        targetGoal: string,
        targetEvaluation: EvaluationResult,
        targetReview: ReviewRecord,
        targetExecutionSummary: string
      ) => any;
      buildRuleRecord: (taskId: string, targetExecutionSummary: string) => RuleRecord;
      buildSkillDraft: (targetGoal: string, source: 'execution' | 'document') => SkillCard;
      addTrace: (node: string, summary: string) => void;
    }
  ): Promise<void> {
    const persistedSummary =
      task.contextFilterState?.filteredContextSlice?.summary &&
      task.contextFilterState.filteredContextSlice.summary.length < executionSummary.length
        ? task.contextFilterState.filteredContextSlice.summary
        : executionSummary;
    await this.hydrateTaskKnowledge(task);
    this.prepareTaskLearning(task, evaluation, review);
    await this.refineTaskLearning(task, evaluation, review);

    const installedSkillIds = Array.from(
      new Set((task.usedInstalledSkills ?? []).map(normalizeInstalledSkillId).filter(Boolean))
    );

    if (evaluation.shouldWriteMemory) {
      const memory = builders.buildMemoryRecord(task.id, goal, evaluation, review, persistedSummary);
      await this.dependencies.memoryRepository.append(memory);
      builders.addTrace('memory_write', `Wrote memory record ${memory.id}`);
    }

    if (evaluation.shouldCreateRule) {
      const rule = builders.buildRuleRecord(task.id, persistedSummary);
      await this.dependencies.ruleRepository.append(rule);
      builders.addTrace('rule_write', `Wrote rule record ${rule.id}`);
    }

    if (shouldExtractSkillForTask(task, evaluation)) {
      const skill = builders.buildSkillDraft(goal, 'execution');
      await this.dependencies.skillRegistry.publishToLab(skill);
      builders.addTrace('skill_extract', `Published skill ${skill.id} to lab`);
    }

    for (const skillId of installedSkillIds) {
      const updated = await this.dependencies.skillRegistry.recordExecutionResult(
        skillId,
        task.runId ?? task.id,
        evaluation.success
      );
      if (!updated) {
        continue;
      }

      const recommendation = updated.governanceRecommendation ?? 'keep-lab';
      const recommendationNote = `已安装技能 ${updated.name} 建议 ${recommendation}，当前成功率 ${(
        updated.successRate ?? 0
      ).toFixed(2)}。`;
      const nextLearningEvaluation = task.learningEvaluation ?? this.prepareTaskLearning(task, evaluation, review);
      if (!nextLearningEvaluation) {
        continue;
      }
      task.learningEvaluation = {
        ...nextLearningEvaluation,
        notes: Array.from(new Set([...(nextLearningEvaluation.notes ?? []), recommendationNote])),
        skillGovernanceRecommendations: [
          ...(nextLearningEvaluation.skillGovernanceRecommendations ?? []).filter(item => item.skillId !== updated.id),
          {
            skillId: updated.id,
            recommendation,
            successRate: updated.successRate,
            promotionState: updated.promotionState
          }
        ]
      };
      task.externalSources = mergeEvidence(task.externalSources ?? [], [
        {
          id: `${task.id}:skill-governance:${updated.id}`,
          taskId: task.id,
          sourceId: updated.id,
          sourceType: 'skill_governance',
          trustClass: 'internal',
          summary: recommendationNote,
          detail: {
            recommendation,
            successRate: updated.successRate,
            promotionState: updated.promotionState
          },
          linkedRunId: task.runId,
          createdAt: updated.updatedAt ?? new Date().toISOString()
        }
      ]);
      builders.addTrace(
        'skill_usage_recorded',
        `Updated installed skill ${updated.id} with success rate ${(updated.successRate ?? 0).toFixed(2)}, recommendation ${recommendation}`
      );
    }
  }

  isDiagnosisTask(task: Pick<TaskRecord, 'goal' | 'context'>): boolean {
    return isDiagnosisTask(task);
  }

  private async refreshSkillSearchIfNeeded(task: TaskRecord, evaluation: LearningEvaluationRecord): Promise<void> {
    if (!evaluation.shouldSearchSkills || !this.settings.policy.suggestionPolicy.autoSearchSkillsOnGap) {
      return;
    }
    if (!this.dependencies.localSkillSuggestionResolver) {
      return;
    }
    if ((task.skillSearch?.suggestions.length ?? 0) >= 3) {
      return;
    }

    const refreshed = await this.dependencies.localSkillSuggestionResolver(task);
    if (!refreshed) {
      return;
    }

    task.skillSearch = refreshed;
    task.learningEvaluation = {
      ...evaluation,
      notes: Array.from(
        new Set([
          ...(evaluation.notes ?? []),
          `Learning 阶段已重新触发 find-skills，返回 ${refreshed.suggestions.length} 个候选。`
        ])
      ),
      expertiseSignals: Array.from(new Set([...(evaluation.expertiseSignals ?? []), 'skill-gap-analysis']))
    };
    if (refreshed.suggestions.length > 0) {
      task.externalSources = mergeEvidence(task.externalSources ?? [], [
        ...refreshed.suggestions.slice(0, 3).map((suggestion, index) => ({
          id: `${task.id}:learning-skill-search:${index}`,
          taskId: task.id,
          sourceId: suggestion.sourceId,
          sourceType: 'skill_search',
          trustClass: suggestion.availability === 'blocked' ? ('community' as const) : ('internal' as const),
          summary: `Learning 阶段技能候选：${suggestion.displayName}（${suggestion.availability}）`,
          detail: {
            suggestionId: suggestion.id,
            availability: suggestion.availability,
            score: suggestion.score,
            reason: suggestion.reason
          },
          linkedRunId: task.runId,
          createdAt: new Date().toISOString()
        }))
      ]);
    }
  }
}

function selectPreferredConflict(candidate: { effectiveness?: number }, conflicts: Array<{ effectiveness?: number }>) {
  if (!conflicts.length) {
    return undefined;
  }
  return conflicts.slice().sort((left, right) => (right.effectiveness ?? 0) - (left.effectiveness ?? 0))[0];
}

function hasMeaningfulMemoryConflict(
  left: { summary: string; tags: string[] },
  right: { summary: string; tags: string[] }
) {
  const leftSummary = left.summary.trim().toLowerCase();
  const rightSummary = right.summary.trim().toLowerCase();
  if (leftSummary === rightSummary) {
    return true;
  }
  const leftTags = new Set(left.tags);
  const overlap = right.tags.filter(tag => leftTags.has(tag));
  return overlap.length >= 2;
}
