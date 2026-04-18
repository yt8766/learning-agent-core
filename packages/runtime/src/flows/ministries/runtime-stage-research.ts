import { EvidenceRecord, MemoryRecord, SkillCard, SpecialistLeadRecord, type AgentExecutionState } from '@agent/core';
import type {
  DeliveryMinistryLike,
  MinistryContractMeta,
  ResearchMinistryLike,
  SourcePolicyMode,
  TaskRecord as CoreTaskRecord
} from '@agent/core';
import { ActionIntent, AgentRole } from '@agent/core';
import {
  buildResearchSourcePlan,
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepStarted,
  mergeEvidence
} from '@agent/agents-supervisor';
import { normalizeSpecialistFinding } from '@agent/core';
import { normalizeExecutionMode } from '../../runtime/runtime-architecture-helpers';

import { handleResearchSkillIntervention } from '../approval/research-skill-interruption';
import type { RuntimeSpecialistFindingRecord as SpecialistFindingRecord } from '../../runtime/runtime-specialist-finding.types';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import { announceSkillStep, completeSkillStep, resolveResearchDispatchObjective } from './runtime-stage-helpers';
import type { PipelineRuntimeCallbacks } from './runtime-stage-types';

type NormalizedResearchResult = {
  summary: string;
  memories: MemoryRecord[];
  knowledgeEvidence: EvidenceRecord[];
  skills: SkillCard[];
  specialistFinding?: SpecialistFindingRecord;
  contractMeta: MinistryContractMeta;
};

function upsertRuntimeSpecialistFinding(task: TaskRecord, input: Parameters<typeof normalizeSpecialistFinding>[0]) {
  const finding = normalizeSpecialistFinding(input) as SpecialistFindingRecord;
  const current: SpecialistFindingRecord[] = task.specialistFindings ?? [];
  task.specialistFindings = [
    ...current.filter(item => !(item.specialistId === finding.specialistId && item.role === finding.role)),
    finding
  ];
  return finding;
}

export async function runResearchStage(
  task: TaskRecord,
  state: RuntimeAgentGraphState,
  hubu: ResearchMinistryLike,
  libuDocs: DeliveryMinistryLike,
  runtimeSourcePolicyMode: SourcePolicyMode | undefined,
  callbacks: PipelineRuntimeCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  markExecutionStepStarted(task, 'research', '户部开始整理资料、记忆与受控来源。', 'hubu');
  callbacks.syncTaskRuntime(task, {
    currentStep: 'research',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.markSubgraph(task, 'research');
  const executionMode =
    task.executionMode ??
    task.executionPlan?.mode ??
    (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute');
  if (normalizeExecutionMode(executionMode) === 'plan') {
    callbacks.addTrace(
      task,
      'planning_readonly_guard',
      '规划阶段已启用只读研究边界，外部 Web / 浏览器 / 终端来源将被禁止。',
      {
        executionMode,
        blockedFamilies: ['open-web', 'browser-automation', 'terminal']
      }
    );
    callbacks.addProgressDelta(
      task,
      '当前仍处于计划模式，只允许仓库内与受控来源研究；open-web、浏览器和终端能力暂不开放。'
    );
  }
  const researchMinistry = callbacks.resolveResearchMinistry(task, task.resolvedWorkflow);
  task.currentMinistry = researchMinistry;
  task.currentWorker = task.modelRoute?.find(item => item.ministry === researchMinistry)?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  const researchSources = buildResearchSourcePlan({
    taskId: task.id,
    runId: task.runId,
    goal: task.goal,
    workflow: task.resolvedWorkflow,
    runtimeSourcePolicyMode,
    executionMode
  });
  const remainingSourceBudget = Math.max(
    0,
    (task.budgetState?.sourceBudget ?? 0) - (task.budgetState?.sourcesConsumed ?? 0)
  );
  const budgetedResearchSources = researchSources.slice(0, remainingSourceBudget);
  if (researchSources.length > budgetedResearchSources.length) {
    callbacks.addTrace(task, 'budget_exhausted', '户部研究来源已按 source budget 裁剪。', {
      sourceBudget: task.budgetState?.sourceBudget,
      sourcesConsumed: task.budgetState?.sourcesConsumed,
      requestedSources: researchSources.length,
      allowedSources: budgetedResearchSources.length
    });
  }
  task.budgetState = callbacks.updateBudgetState(task, {
    sourcesConsumed: (task.budgetState?.sourcesConsumed ?? 0) + budgetedResearchSources.length
  });
  if (budgetedResearchSources.length) {
    task.externalSources = mergeEvidence(task.externalSources ?? [], budgetedResearchSources);
    task.knowledgeIngestionState = {
      node: 'knowledge_ingestion',
      store: 'cangjing',
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
    task.knowledgeIndexState = {
      node: 'knowledge_index',
      store: 'cangjing',
      indexStatus: 'ready',
      searchableDocumentCount: budgetedResearchSources.length,
      blockedDocumentCount: 0,
      updatedAt: new Date().toISOString()
    };
    for (const source of budgetedResearchSources) {
      callbacks.addTrace(task, 'research', `户部已锁定研究来源：${source.summary}`, {
        ministry: researchMinistry,
        sourceUrl: source.sourceUrl,
        sourceType: source.sourceType,
        trustClass: source.trustClass
      });
    }
  }
  callbacks.addTrace(task, 'ministry_started', '户部开始检索上下文与资料。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(task, '户部已开始检索资料与上下文。', AgentRole.RESEARCH);
  callbacks.setSubTaskStatus(task, AgentRole.RESEARCH, 'running');
  announceSkillStep(task, 'research', callbacks);
  const researchResultRaw =
    researchMinistry === 'libu-delivery'
      ? {
          ...(await libuDocs.research(task as CoreTaskRecord)),
          knowledgeEvidence: [],
          specialistFinding: undefined,
          contractMeta: {
            contractName: 'research-evidence',
            contractVersion: 'research-evidence.v1',
            parseStatus: 'success',
            fallbackUsed: false
          } satisfies MinistryContractMeta
        }
      : await hubu.research(resolveResearchDispatchObjective(state.dispatches));
  const researchResult: NormalizedResearchResult = {
    summary: researchResultRaw.summary,
    memories: researchResultRaw.memories,
    knowledgeEvidence: researchResultRaw.knowledgeEvidence,
    skills: researchResultRaw.skills,
    specialistFinding: researchResultRaw.specialistFinding as SpecialistFindingRecord | undefined,
    contractMeta: researchResultRaw.contractMeta
  };
  callbacks.ensureTaskNotCancelled(task);
  if (researchResult.knowledgeEvidence.length) {
    task.externalSources = mergeEvidence(task.externalSources ?? [], researchResult.knowledgeEvidence);
    const searchableDocumentCount = new Set(
      researchResult.knowledgeEvidence.map(item => String(item.detail?.documentId ?? item.id))
    ).size;
    task.knowledgeIngestionState = {
      node: 'knowledge_ingestion',
      store: 'cangjing',
      status: 'completed',
      updatedAt: new Date().toISOString()
    };
    task.knowledgeIndexState = {
      node: 'knowledge_index',
      store: 'cangjing',
      indexStatus: 'ready',
      searchableDocumentCount: Math.max(
        task.knowledgeIndexState?.searchableDocumentCount ?? 0,
        searchableDocumentCount
      ),
      blockedDocumentCount: task.knowledgeIndexState?.blockedDocumentCount ?? 0,
      updatedAt: new Date().toISOString()
    };
  }
  callbacks.upsertAgentState(task, researchMinistry === 'libu-delivery' ? libuDocs.getState() : hubu.getState());
  callbacks.addMessage(task, 'research_result', researchResult.summary, AgentRole.RESEARCH);
  callbacks.addTrace(task, 'research', researchResult.summary, {
    ministry: task.currentMinistry,
    memoryCount: researchResult.memories.length,
    knowledgeEvidenceCount: researchResult.knowledgeEvidence.length,
    skillCount: researchResult.skills.length,
    status: researchResult.contractMeta.parseStatus === 'success' ? 'success' : 'failed',
    isFallback: researchResult.contractMeta.fallbackUsed,
    fallbackReason: researchResult.contractMeta.fallbackReason,
    contractName: researchResult.contractMeta.contractName,
    contractVersion: researchResult.contractMeta.contractVersion,
    parseStatus: researchResult.contractMeta.parseStatus
  });
  const researchEvidenceRefs = (task.externalSources ?? []).slice(0, 5).map(source => source.id);
  if (task.specialistLead) {
    upsertRuntimeSpecialistFinding(
      task,
      (researchResult.specialistFinding ?? {
        specialistId: task.specialistLead.domain,
        role: 'lead',
        source: 'research',
        stage: 'research',
        domain: task.specialistLead.domain,
        summary: researchResult.summary,
        suggestions: [task.specialistLead.reason ?? '结合研究结果继续形成统一判断。'],
        evidenceRefs: researchEvidenceRefs,
        confidence: task.routeConfidence
      }) as Parameters<typeof normalizeSpecialistFinding>[0]
    );
  }
  for (const support of task.supportingSpecialists ?? []) {
    const slice = task.contextSlicesBySpecialist?.find(item => item.specialistId === support.id);
    upsertRuntimeSpecialistFinding(task, {
      specialistId: support.domain,
      role: 'support',
      source: 'research',
      stage: 'research',
      domain: support.domain,
      summary: `${support.displayName} 已收到并发补充任务。${researchResult.summary}`,
      constraints: slice?.domainInstruction ? [slice.domainInstruction] : undefined,
      suggestions: support.reason ? [support.reason] : undefined,
      evidenceRefs: researchEvidenceRefs,
      confidence: task.routeConfidence ? Math.max(0.2, task.routeConfidence - 0.1) : undefined
    });
  }
  callbacks.addTrace(task, 'ministry_reported', '户部已提交检索战报。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  completeSkillStep(task, 'research');
  callbacks.addProgressDelta(task, `户部战报：${researchResult.summary}`, AgentRole.RESEARCH);
  callbacks.setSubTaskStatus(task, AgentRole.RESEARCH, 'completed');
  markExecutionStepCompleted(
    task,
    'research',
    researchResult.summary,
    researchMinistry === 'libu-delivery' ? 'libu-docs' : 'hubu'
  );

  const intervention = await handleResearchSkillIntervention(task, callbacks, researchMinistry);
  if (intervention.interrupted) {
    markExecutionStepBlocked(
      task,
      'approval-interrupt',
      '研究阶段需要审批或补装能力。',
      '研究阶段已暂停等待恢复。',
      'system'
    );
    return intervention.statePatch;
  }

  await callbacks.persistAndEmitTask(task);
  return {
    currentStep: 'research',
    observations: [...state.observations, researchResult.summary],
    retrievedMemories: researchResult.memories,
    retrievedSkills: researchResult.skills,
    researchSummary: researchResult.summary,
    resumeFromApproval: false
  };
}
