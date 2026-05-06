import { loadSettings } from '@agent/config';
import { z } from 'zod/v4';
import type { AgentSkillReuseRecord, ILLMProvider as LlmProvider } from '@agent/core';
import { MemoryRepository, RuleRepository, MemorySearchService } from '@agent/memory';
import { generateObjectWithRetry } from '@agent/adapters';
import type { EvaluationResult, LearningEvaluationRecord } from '@agent/core';
import { ReviewRecord, SkillCard } from '@agent/core';
import { SkillRegistry } from '@agent/skill';
import type { RuntimeLearningJob as LearningJob } from '../../runtime/runtime-learning.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';

import { archivalMemorySearchByParams } from '../../memory/active-memory-tools';
import { flattenStructuredMemories } from '../../memory/runtime-memory-search';
import { autoPersistResearchMemory, evaluateResearchJob } from './learning-flow-research';
import { confirmSelectedLearningCandidates } from './nodes/learning-candidate-confirmation';
import {
  ensureCandidates,
  mergeEvidence,
  normalizeInstalledSkillId,
  prepareTaskLearning,
  shouldExtractSkillForTask
} from './learning-flow-task';
import { isDiagnosisTask } from './shared/learning-task-diagnosis';
import type { RuleRecord } from '@agent/memory';

interface LearningFlowDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  ruleRepository: RuleRepository;
  skillRegistry: SkillRegistry;
  llmProvider?: LlmProvider;
  thinking?: boolean;
  settings?: ReturnType<typeof loadSettings>;
  localSkillSuggestionResolver?: (task: TaskRecord) => Promise<TaskRecord['skillSearch'] | undefined>;
  recordWorkspaceSkillReuse?: (record: LearningWorkspaceSkillReuseRecord) => Promise<void> | void;
}

type LearningWorkspaceSkillReuseRecord = Pick<
  AgentSkillReuseRecord,
  'id' | 'skillId' | 'taskId' | 'sourceDraftId' | 'outcome' | 'evidenceRefs' | 'reusedAt'
>;

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

    const related = (await archivalMemorySearchByParams(this.dependencies.memorySearchService, {
      query,
      limit,
      actorRole: 'learning',
      scopeType: 'task',
      allowedScopeTypes: ['task', 'workspace', 'team', 'org', 'global', 'user'],
      taskId: task.id,
      memoryTypes: ['constraint', 'procedure', 'skill-experience', 'failure-pattern'],
      includeRules: true,
      includeReflections: true
    })) ?? {
      coreMemories: [],
      archivalMemories: await this.dependencies.memoryRepository.search(query, limit),
      rules: [],
      reflections: [],
      reasons: []
    };
    const relatedMemories = flattenStructuredMemories(related);
    task.reusedMemories = Array.from(
      new Set([...(task.reusedMemories ?? []), ...relatedMemories.map(memory => memory.id)])
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
    return confirmSelectedLearningCandidates(task, candidateIds, {
      memoryRepository: this.dependencies.memoryRepository,
      ruleRepository: this.dependencies.ruleRepository,
      skillRegistry: this.dependencies.skillRegistry
    });
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
      const evidenceId = `${task.id}:skill-governance:${updated.id}`;
      const reusedAt = updated.updatedAt ?? new Date().toISOString();
      task.externalSources = mergeEvidence(task.externalSources ?? [], [
        {
          id: evidenceId,
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
          createdAt: reusedAt
        }
      ]);
      await this.dependencies.recordWorkspaceSkillReuse?.({
        id: `reuse:${task.runId ?? task.id}:${updated.id}`,
        skillId: updated.id,
        taskId: task.id,
        outcome: evaluation.success ? 'succeeded' : 'failed',
        evidenceRefs: [evidenceId],
        reusedAt
      });
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
