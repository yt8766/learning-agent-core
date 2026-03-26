import { MemoryRepository, MemorySearchService, RuleRepository } from '@agent/memory';
import {
  EvidenceRecord,
  EvaluationResult,
  LearningEvaluationRecord,
  LearningCandidateRecord,
  LearningJob,
  MemoryRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord,
  TaskStatus
} from '@agent/shared';
import { SkillRegistry } from '@agent/skills';

interface LearningFlowDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  ruleRepository: RuleRepository;
  skillRegistry: SkillRegistry;
}

export class LearningFlow {
  constructor(private readonly dependencies: LearningFlowDependencies) {}

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
    const sources = job.sources ?? [];
    const externalSourceCount = sources.filter(source => source.trustClass !== 'internal').length;
    const internalSourceCount = sources.filter(source => source.trustClass === 'internal').length;
    const officialCount = sources.filter(source => source.trustClass === 'official').length;
    const curatedCount = sources.filter(source => source.trustClass === 'curated').length;
    const communityCount = sources.filter(source => source.trustClass === 'community').length;

    const score = Math.max(
      0,
      Math.min(100, officialCount * 20 + curatedCount * 12 + communityCount * 5 + internalSourceCount * 4)
    );
    const confidence = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
    const notes = [
      officialCount > 0 ? `本轮研究命中了 ${officialCount} 条官方来源。` : '本轮研究未命中官方来源。',
      curatedCount > 0 ? `补充了 ${curatedCount} 条 curated 来源。` : '没有补充 curated 来源。',
      communityCount > 0 ? `社区来源 ${communityCount} 条，后续需要人工复核。` : '没有使用社区来源。'
    ];

    return {
      score,
      confidence,
      notes,
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount,
        internalSourceCount,
        reusedMemoryCount: 0,
        reusedRuleCount: 0,
        reusedSkillCount: 0
      }
    };
  }

  async autoPersistResearchMemory(
    job: LearningJob,
    policy: 'manual' | 'high-confidence' = 'manual'
  ): Promise<string[]> {
    const evaluation = job.learningEvaluation ?? this.evaluateResearchJob(job);
    job.learningEvaluation = evaluation;

    const conflicts = await this.dependencies.memoryRepository.search(job.goal ?? job.summary ?? job.documentUri, 3);
    const effectiveConflicts = conflicts.filter(
      memory => memory.tags.includes('research-job') || memory.summary === job.summary
    );
    if (effectiveConflicts.length > 0) {
      job.conflictDetected = true;
      job.conflictNotes = effectiveConflicts.map(memory => `已存在相似 research memory：${memory.id}`);
      job.autoPersistEligible = false;
      job.persistedMemoryIds = [];
      job.learningEvaluation = {
        ...evaluation,
        governanceWarnings: [...(evaluation.governanceWarnings ?? []), ...job.conflictNotes]
      };
      return [];
    }

    if (policy !== 'high-confidence' || evaluation.confidence !== 'high') {
      job.autoPersistEligible = false;
      job.persistedMemoryIds = [];
      return [];
    }

    const persistedMemory: MemoryRecord = {
      id: `mem_research_${job.id}`,
      type: 'fact',
      taskId: job.id,
      summary: job.summary ?? `Research summary for ${job.goal ?? job.documentUri}`,
      content: (job.sources ?? [])
        .map(source => `- [${source.trustClass}] ${source.summary}${source.sourceUrl ? ` (${source.sourceUrl})` : ''}`)
        .join('\n'),
      tags: ['research-job', 'auto-persist', job.workflowId ?? 'general'],
      qualityScore: evaluation.score,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await this.dependencies.memoryRepository.append(persistedMemory);
    job.autoPersistEligible = true;
    job.persistedMemoryIds = [persistedMemory.id];
    return job.persistedMemoryIds;
  }

  prepareTaskLearning(
    task: TaskRecord,
    evaluation?: EvaluationResult,
    review?: ReviewRecord
  ): LearningEvaluationRecord | undefined {
    const externalSources = this.mergeEvidence(task.externalSources ?? [], this.deriveEvidence(task));
    const reusedMemories = Array.from(
      new Set([
        ...(task.reusedMemories ?? []),
        ...task.agentStates.flatMap(agentState => agentState.longTermMemoryRefs ?? []).filter(Boolean)
      ])
    );
    const reusedSkills = Array.from(
      new Set([
        ...task.trace.flatMap(trace => {
          const data = trace.data ?? {};
          const ids = data.skillIds;
          if (Array.isArray(ids)) {
            return ids.filter((id): id is string => typeof id === 'string');
          }
          if (typeof data.skillId === 'string') {
            return [data.skillId];
          }
          return [];
        }),
        ...(task.usedInstalledSkills ?? []).map(workerId => this.normalizeInstalledSkillId(workerId)).filter(Boolean)
      ])
    );
    const reusedRules = task.reusedRules ?? [];
    const sourceSummary = {
      externalSourceCount: externalSources.filter(source => source.trustClass !== 'internal').length,
      internalSourceCount: externalSources.filter(source => source.trustClass === 'internal').length,
      reusedMemoryCount: reusedMemories.length,
      reusedRuleCount: reusedRules.length,
      reusedSkillCount: reusedSkills.length
    };
    const score = Math.max(
      0,
      Math.min(
        100,
        (evaluation?.success ? 35 : 10) +
          (evaluation?.quality === 'high' ? 25 : evaluation?.quality === 'medium' ? 15 : 5) +
          Math.min(20, sourceSummary.externalSourceCount * 6 + sourceSummary.internalSourceCount * 2) +
          Math.min(20, sourceSummary.reusedMemoryCount * 4 + sourceSummary.reusedSkillCount * 6)
      )
    );
    const confidence = score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low';
    const notes = [
      review ? `评审结论：${review.decision}` : '尚未形成评审结论。',
      sourceSummary.externalSourceCount > 0
        ? `本轮沉淀引用了 ${sourceSummary.externalSourceCount} 条外部来源。`
        : '本轮主要依赖内部执行痕迹与已有经验。',
      sourceSummary.reusedMemoryCount + sourceSummary.reusedSkillCount > 0
        ? `复用了 ${sourceSummary.reusedMemoryCount} 条记忆与 ${sourceSummary.reusedSkillCount} 个技能。`
        : '本轮没有明显复用既有技能或记忆。',
      (task.usedInstalledSkills?.length ?? 0) > 0
        ? `本轮命中了 ${(task.usedInstalledSkills ?? []).length} 个已安装技能。`
        : '本轮未命中已安装技能。',
      (task.usedCompanyWorkers?.length ?? 0) > 0
        ? `本轮调用了 ${(task.usedCompanyWorkers ?? []).length} 个公司专员。`
        : '本轮未调用公司专员。',
      task.skillSearch?.capabilityGapDetected
        ? `任务开始时检测到能力缺口，当前本地技能候选 ${task.skillSearch.suggestions.length} 个。`
        : '任务开始时未检测到明显能力缺口。'
    ];

    task.externalSources = externalSources;
    task.reusedMemories = reusedMemories;
    task.reusedRules = reusedRules;
    task.reusedSkills = reusedSkills;
    task.learningEvaluation = {
      score,
      confidence,
      notes,
      skillGovernanceRecommendations: [],
      recommendedCandidateIds: task.learningCandidates?.map(candidate => candidate.id) ?? [],
      autoConfirmCandidateIds: [],
      sourceSummary
    };
    return task.learningEvaluation;
  }

  ensureCandidates(task: TaskRecord): LearningCandidateRecord[] {
    if (!task.learningEvaluation) {
      this.prepareTaskLearning(task);
    }

    if (task.learningCandidates?.length) {
      return task.learningCandidates;
    }

    const now = new Date().toISOString();
    const confidenceScore = task.learningEvaluation?.score;
    const autoConfirmMemory =
      task.learningEvaluation?.confidence === 'high' &&
      (task.learningEvaluation?.sourceSummary.externalSourceCount ?? 0) <= 2;
    task.learningCandidates = [
      {
        id: `learn_mem_${Date.now()}`,
        taskId: task.id,
        type: 'memory',
        summary: '沉淀本轮多 Agent 执行经验',
        status: 'pending_confirmation',
        confidenceScore,
        autoConfirmEligible: autoConfirmMemory,
        provenance: task.externalSources,
        payload: {
          id: `mem_candidate_${Date.now()}`,
          type: task.status === TaskStatus.COMPLETED ? 'success_case' : 'failure_case',
          taskId: task.id,
          summary: `围绕 ${task.goal} 的多 Agent 经验总结`,
          content: task.result ?? '',
          tags: ['chat-session', 'multi-agent'],
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_rule_${Date.now()}`,
        taskId: task.id,
        type: 'rule',
        summary: '沉淀可复用的执行约束',
        status: 'pending_confirmation',
        confidenceScore,
        provenance: task.externalSources,
        payload: {
          id: `rule_candidate_${Date.now()}`,
          name: 'Chat Session Rule Candidate',
          summary: '当类似目标再次出现时复用这条规则',
          conditions: [`taskId=${task.id}`],
          action: task.result ?? 'review task result',
          sourceTaskId: task.id,
          createdAt: now
        },
        createdAt: now
      },
      {
        id: `learn_skill_${Date.now()}`,
        taskId: task.id,
        type: 'skill',
        summary: '将本轮执行抽取为技能候选并进入 lab',
        status: 'pending_confirmation',
        confidenceScore,
        provenance: task.externalSources,
        payload: {
          id: `skill_candidate_${Date.now()}`,
          name: 'Chat Session Skill Candidate',
          description: '从主 Agent 与子 Agent 协作过程中提炼出的可复用技能。',
          applicableGoals: [task.goal],
          requiredTools: ['search_memory', 'read_local_file'],
          steps:
            task.plan?.steps.map((step, index) => ({
              title: `Step ${index + 1}`,
              instruction: step,
              toolNames: ['search_memory']
            })) ?? [],
          constraints: ['高风险动作必须人工确认'],
          successSignals: ['任务成功完成', 'review 给出 approved 结论'],
          riskLevel: 'medium',
          source: 'execution',
          status: 'lab',
          createdAt: now,
          updatedAt: now
        },
        createdAt: now
      }
    ];

    if (task.learningEvaluation) {
      task.learningEvaluation.recommendedCandidateIds = task.learningCandidates.map(candidate => candidate.id);
      task.learningEvaluation.autoConfirmCandidateIds = task.learningCandidates
        .filter(candidate => candidate.autoConfirmEligible)
        .map(candidate => candidate.id);
    }

    return task.learningCandidates;
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
        await this.dependencies.memoryRepository.append(candidate.payload as never);
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
    await this.hydrateTaskKnowledge(task);
    this.prepareTaskLearning(task, evaluation, review);

    const installedSkillIds = Array.from(
      new Set(
        (task.usedInstalledSkills ?? []).map(workerId => this.normalizeInstalledSkillId(workerId)).filter(Boolean)
      )
    );

    if (evaluation.shouldWriteMemory) {
      const memory = builders.buildMemoryRecord(task.id, goal, evaluation, review, executionSummary);
      await this.dependencies.memoryRepository.append(memory);
      builders.addTrace('memory_write', `Wrote memory record ${memory.id}`);
    }

    if (evaluation.shouldCreateRule) {
      const rule = builders.buildRuleRecord(task.id, executionSummary);
      await this.dependencies.ruleRepository.append(rule);
      builders.addTrace('rule_write', `Wrote rule record ${rule.id}`);
    }

    if (evaluation.shouldExtractSkill) {
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
      if (updated) {
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
            ...(nextLearningEvaluation.skillGovernanceRecommendations ?? []).filter(
              item => item.skillId !== updated.id
            ),
            {
              skillId: updated.id,
              recommendation,
              successRate: updated.successRate,
              promotionState: updated.promotionState
            }
          ]
        };
        task.externalSources = this.mergeEvidence(task.externalSources ?? [], [
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
          `Updated installed skill ${updated.id} with success rate ${(updated.successRate ?? 0).toFixed(
            2
          )}, recommendation ${recommendation}`
        );
      }
    }
  }

  private deriveEvidence(task: TaskRecord): EvidenceRecord[] {
    const sources = task.trace
      .map((trace, index) => {
        const data = trace.data ?? {};
        const sourceUrl = typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined;
        const sourceType = typeof data.sourceType === 'string' ? data.sourceType : sourceUrl ? 'web' : 'trace';
        const trustClass = sourceUrl ? this.inferTrustClass(sourceUrl) : ('internal' as const);

        return {
          id: `${task.id}:evidence:${index}`,
          taskId: task.id,
          sourceType,
          sourceUrl,
          trustClass,
          summary: trace.summary,
          detail: data,
          linkedRunId: task.runId,
          createdAt: trace.at
        } satisfies EvidenceRecord;
      })
      .filter((item, index, list) => {
        const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
        return (
          list.findIndex(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key) ===
          index
        );
      });

    const installedSkillEvidence = (task.usedInstalledSkills ?? []).map((workerId, index) => ({
      id: `${task.id}:installed-skill:${index}`,
      taskId: task.id,
      sourceId: this.normalizeInstalledSkillId(workerId),
      sourceType: 'installed_skill',
      trustClass: 'internal' as const,
      summary: `本轮执行命中了已安装技能 ${this.normalizeInstalledSkillId(workerId)}。`,
      detail: {
        workerId
      },
      linkedRunId: task.runId,
      createdAt: task.updatedAt
    }));

    const companyWorkerEvidence = (task.usedCompanyWorkers ?? []).map((workerId, index) => ({
      id: `${task.id}:company-worker:${index}`,
      taskId: task.id,
      sourceId: workerId,
      sourceType: 'company_worker',
      trustClass: 'internal' as const,
      summary: `本轮执行调用了公司专员 ${workerId}。`,
      detail: {
        workerId
      },
      linkedRunId: task.runId,
      createdAt: task.updatedAt
    }));

    return [...sources, ...installedSkillEvidence, ...companyWorkerEvidence].slice(-12);
  }

  private mergeEvidence(existing: EvidenceRecord[], incoming: EvidenceRecord[]): EvidenceRecord[] {
    const merged = [...existing];
    for (const item of incoming) {
      const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
      if (!merged.some(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key)) {
        merged.push(item);
      }
    }
    return merged;
  }

  private inferTrustClass(sourceUrl: string): EvidenceRecord['trustClass'] {
    try {
      const host = new URL(sourceUrl).hostname.toLowerCase();
      if (
        host.includes('openai.com') ||
        host.includes('anthropic.com') ||
        host.includes('deepseek.com') ||
        host.includes('openclaw.ai') ||
        host.includes('open-claw.org') ||
        host.includes('npmjs.com') ||
        host.includes('developer.mozilla.org')
      ) {
        return 'official';
      }
      if (host.includes('github.com')) {
        return 'curated';
      }
      return 'community';
    } catch {
      return 'unverified';
    }
  }

  private normalizeInstalledSkillId(workerId: string): string {
    return workerId.startsWith('installed-skill:') ? workerId.replace('installed-skill:', '') : workerId;
  }
}
