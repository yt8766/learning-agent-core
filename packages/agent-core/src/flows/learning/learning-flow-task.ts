import {
  EvidenceRecord,
  EvaluationResult,
  LearningCandidateRecord,
  LearningEvaluationRecord,
  ReviewRecord,
  RuleRecord,
  SkillCard,
  TaskRecord,
  TaskStatus
} from '@agent/shared';

export function isDiagnosisTask(task: Pick<TaskRecord, 'goal' | 'context'>): boolean {
  const normalizedGoal = String(task.goal ?? '')
    .trim()
    .toLowerCase();
  const normalizedContext = String(task.context ?? '')
    .trim()
    .toLowerCase();
  return (
    normalizedContext.includes('diagnosis_for:') ||
    normalizedGoal.includes('请诊断任务') ||
    normalizedGoal.includes('agent 错误') ||
    normalizedGoal.includes('恢复方案') ||
    normalizedGoal.includes('diagnose task')
  );
}

export function prepareTaskLearning(
  task: TaskRecord,
  evaluation?: EvaluationResult,
  review?: ReviewRecord
): LearningEvaluationRecord {
  const externalSources = mergeEvidence(task.externalSources ?? [], deriveEvidence(task));
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
      ...(task.usedInstalledSkills ?? []).map(normalizeInstalledSkillId).filter(Boolean)
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
  const extractedPreferences = extractPreferenceSignals(task);
  const candidateReasons = buildCandidateReasons(task, evaluation, extractedPreferences);
  const skippedReasons = buildSkippedReasons(task, evaluation, extractedPreferences);
  const notes = [
    review ? `评审结论：${review.decision}` : '尚未形成评审结论。',
    isDiagnosisTask(task) ? '本轮属于 agent 故障诊断沉淀，后续应优先复用根因与恢复步骤。' : '',
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
      : '任务开始时未检测到明显能力缺口。',
    ...extractedPreferences.map(item => `检测到可长期沉淀的偏好/约束：${item.summary}`)
  ].filter(Boolean);

  const shouldExtractSkill = shouldExtractSkillForTask(task, evaluation);
  task.externalSources = externalSources;
  task.reusedMemories = reusedMemories;
  task.reusedRules = reusedRules;
  task.reusedSkills = reusedSkills;
  task.learningEvaluation = {
    score,
    confidence,
    shouldLearn: score >= 45,
    shouldSearchSkills: Boolean(task.skillSearch?.capabilityGapDetected),
    suggestedCandidateTypes: [
      evaluation?.shouldWriteMemory !== false ? 'memory' : null,
      evaluation?.shouldCreateRule !== false ? 'rule' : null,
      shouldExtractSkill ? 'skill' : null
    ].filter(Boolean) as Array<'memory' | 'rule' | 'skill'>,
    rationale: task.skillSearch?.capabilityGapDetected
      ? '任务存在能力缺口，优先判断是否需要补充技能复用或沉淀新技能。'
      : '任务已基于执行质量、证据和复用情况完成学习评估。',
    notes,
    candidateReasons,
    skippedReasons,
    conflictDetected: false,
    conflictTargets: [],
    derivedFromLayers: ['L1-session', 'L2-memory', 'L5-runtime-snapshot'],
    policyMode: 'profile-inherited',
    expertiseSignals: extractedPreferences.length > 0 ? ['user-preference', 'domain-expert'] : ['domain-expert'],
    skillGovernanceRecommendations: [],
    recommendedCandidateIds: task.learningCandidates?.map(candidate => candidate.id) ?? [],
    autoConfirmCandidateIds: [],
    sourceSummary
  };
  return task.learningEvaluation;
}

export function ensureCandidates(task: TaskRecord): LearningCandidateRecord[] {
  if (!task.learningEvaluation) {
    prepareTaskLearning(task);
  }

  if (task.learningEvaluation?.shouldLearn === false) {
    task.learningCandidates = [];
    task.learningEvaluation.recommendedCandidateIds = [];
    task.learningEvaluation.autoConfirmCandidateIds = [];
    return [];
  }

  if (task.learningCandidates?.length) {
    return task.learningCandidates;
  }

  const now = new Date().toISOString();
  const confidenceScore = task.learningEvaluation?.score;
  const candidateTypes = new Set(task.learningEvaluation?.suggestedCandidateTypes ?? ['memory', 'rule', 'skill']);
  const preferenceCandidates = buildPreferenceMemoryCandidates(task, now, confidenceScore);
  const autoConfirmMemory =
    task.learningEvaluation?.confidence === 'high' &&
    (task.learningEvaluation?.sourceSummary.externalSourceCount ?? 0) <= 2;
  task.learningCandidates = [
    ...preferenceCandidates,
    candidateTypes.has('memory')
      ? {
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
            type:
              task.status === TaskStatus.COMPLETED && isHighValueTask(task)
                ? 'task_summary'
                : task.status === TaskStatus.COMPLETED
                  ? 'success_case'
                  : 'failure_case',
            taskId: task.id,
            summary: `围绕 ${task.goal} 的多 Agent 经验总结`,
            content: task.result ?? '',
            tags: ['task-experience', 'multi-agent'],
            createdAt: now
          },
          createdAt: now
        }
      : null,
    candidateTypes.has('rule')
      ? {
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
        }
      : null,
    candidateTypes.has('skill')
      ? {
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
      : null
  ].filter(Boolean) as LearningCandidateRecord[];

  if (task.learningEvaluation) {
    task.learningEvaluation.recommendedCandidateIds = task.learningCandidates.map(candidate => candidate.id);
    task.learningEvaluation.autoConfirmCandidateIds = task.learningCandidates
      .filter(candidate => candidate.autoConfirmEligible)
      .map(candidate => candidate.id);
  }

  return task.learningCandidates;
}

export function shouldExtractSkillForTask(
  task: Pick<TaskRecord, 'goal' | 'context' | 'result'>,
  evaluation?: Pick<EvaluationResult, 'shouldExtractSkill'>
) {
  if (!evaluation?.shouldExtractSkill) {
    return false;
  }

  const corpus = `${task.goal ?? ''}\n${task.context ?? ''}\n${task.result ?? ''}`.toLowerCase();
  const blockedPatterns = [
    /周报/,
    /日报/,
    /月报/,
    /年报/,
    /工作总结/,
    /总结一下/,
    /生成.*周报/,
    /撰写.*周报/,
    /写.*周报/,
    /润色/,
    /改写/,
    /翻译/,
    /邮件/,
    /文案/,
    /汇报/,
    /稿子/,
    /草稿/
  ];
  return !blockedPatterns.some(pattern => pattern.test(corpus));
}

function buildPreferenceMemoryCandidates(
  task: TaskRecord,
  now: string,
  confidenceScore?: number
): LearningCandidateRecord[] {
  const signals = extractPreferenceSignals(task);
  return signals.map((signal, index) => ({
    id: `learn_pref_${Date.now()}_${index}`,
    taskId: task.id,
    type: 'memory',
    summary: signal.summary,
    status: 'pending_confirmation',
    confidenceScore: confidenceScore ?? 80,
    autoConfirmEligible: signal.autoConfirmEligible,
    provenance: task.externalSources,
    payload: {
      id: `mem_pref_${Date.now()}_${index}`,
      type: signal.memoryType,
      taskId: task.id,
      summary: signal.summary,
      content: signal.content,
      tags: signal.tags,
      createdAt: now
    },
    createdAt: now
  }));
}

function extractPreferenceSignals(task: Pick<TaskRecord, 'goal' | 'context' | 'result'>) {
  const corpus = `${task.goal ?? ''}\n${task.context ?? ''}\n${task.result ?? ''}`;
  const signals: Array<{
    summary: string;
    content: string;
    tags: string[];
    memoryType: 'fact' | 'heuristic';
    autoConfirmEligible: boolean;
  }> = [];

  if (/最终答复|final answer|只看最终/i.test(corpus)) {
    signals.push({
      summary: '用户偏好主聊天区只显示最终答复',
      content: 'Prefer main chat area to emphasize final answers instead of intermediate confirmations.',
      tags: ['user-preference', 'output-style'],
      memoryType: 'fact',
      autoConfirmEligible: true
    });
  }
  if (/审批.*聊天记录|聊天记录.*审批|approval.*chat/i.test(corpus)) {
    signals.push({
      summary: '用户偏好把审批动作放在聊天记录中处理',
      content: 'Prefer approval interactions to happen inline inside the chat thread.',
      tags: ['user-preference', 'approval-policy', 'ui-preference'],
      memoryType: 'heuristic',
      autoConfirmEligible: true
    });
  }
  if (/专业建议|领域专家|expert/i.test(corpus)) {
    signals.push({
      summary: '用户偏好默认提供领域专家风格建议',
      content: 'Prefer domain-expert suggestions by default when generating recommendations.',
      tags: ['user-preference', 'domain-preference'],
      memoryType: 'fact',
      autoConfirmEligible: true
    });
  }
  return signals;
}

function buildCandidateReasons(
  task: TaskRecord,
  evaluation: EvaluationResult | undefined,
  extractedPreferences: ReturnType<typeof extractPreferenceSignals>
) {
  const reasons = [
    evaluation?.success ? '任务成功完成，适合沉淀执行经验。' : undefined,
    extractedPreferences.length > 0 ? `检测到 ${extractedPreferences.length} 条稳定偏好/约束。` : undefined,
    task.skillSearch?.capabilityGapDetected ? '存在能力缺口，适合同时沉淀 skill gap 线索。' : undefined
  ];
  return reasons.filter(Boolean) as string[];
}

function buildSkippedReasons(
  task: TaskRecord,
  evaluation: EvaluationResult | undefined,
  extractedPreferences: ReturnType<typeof extractPreferenceSignals>
) {
  const reasons = [
    extractedPreferences.length === 0 ? '未检测到足够稳定的长期偏好表达。' : undefined,
    !shouldExtractSkillForTask(task, evaluation) ? '本轮未满足抽取技能候选的条件。' : undefined,
    task.skillSearch?.capabilityGapDetected === false ? '当前未检测到明显能力缺口，无需额外 skill 搜索。' : undefined
  ];
  return reasons.filter(Boolean) as string[];
}

function isHighValueTask(task: Pick<TaskRecord, 'goal' | 'externalSources'>) {
  return (task.externalSources?.length ?? 0) >= 3 || /发布|架构|测试|review|诊断/i.test(task.goal);
}

export function deriveEvidence(task: TaskRecord): EvidenceRecord[] {
  const sources = task.trace
    .map((trace, index) => {
      const data = trace.data ?? {};
      const sourceUrl = typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined;
      const sourceType = typeof data.sourceType === 'string' ? data.sourceType : sourceUrl ? 'web' : 'trace';
      const trustClass = sourceUrl ? inferTrustClass(sourceUrl) : ('internal' as const);

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
    sourceId: normalizeInstalledSkillId(workerId),
    sourceType: 'installed_skill',
    trustClass: 'internal' as const,
    summary: `本轮执行命中了已安装技能 ${normalizeInstalledSkillId(workerId)}。`,
    detail: { workerId },
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
    detail: { workerId },
    linkedRunId: task.runId,
    createdAt: task.updatedAt
  }));

  return [...sources, ...installedSkillEvidence, ...companyWorkerEvidence].slice(-12);
}

export function mergeEvidence(existing: EvidenceRecord[], incoming: EvidenceRecord[]): EvidenceRecord[] {
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
    if (!merged.some(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key)) {
      merged.push(item);
    }
  }
  return merged;
}

export function inferTrustClass(sourceUrl: string): EvidenceRecord['trustClass'] {
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

export function normalizeInstalledSkillId(workerId: string): string {
  return workerId.startsWith('installed-skill:') ? workerId.replace('installed-skill:', '') : workerId;
}
