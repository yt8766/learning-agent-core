import { AgentRole, EvaluationResult, ReviewRecord, TaskRecord, TaskStatus } from '@agent/shared';
import { LibuDocsMinistry, LibuRouterMinistry, XingbuReviewMinistry } from './index';
import { applyReactiveCompactRetry, buildContextCompressionResult } from '../../utils/context-compression-pipeline';
import { normalizeCritiqueResult } from '../../shared/schemas/critique-result-schema';
import { StructuredContractMeta } from '../../utils/schemas/safe-generate-object';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepStarted
} from '../../workflows/execution-steps';
import { upsertSpecialistFinding } from '../../shared/schemas/specialist-finding-schema';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import {
  applyCapabilityTrustFromGovernance,
  buildGovernanceReport,
  buildGovernanceScore
} from './governance-stage-helpers';
import { buildFinalReviewSummary, deriveFinalReviewDecision } from './review-stage-helpers';

type NormalizedReviewResult = {
  review: ReviewRecord;
  evaluation: EvaluationResult;
  critiqueResult?: TaskRecord['critiqueResult'];
  specialistFinding?: NonNullable<TaskRecord['specialistFindings']>[number];
  contractMeta: StructuredContractMeta;
};

interface ReviewCallbacks {
  ensureTaskNotCancelled: (task: TaskRecord) => void;
  syncTaskRuntime: (
    task: TaskRecord,
    state: Pick<RuntimeAgentGraphState, 'currentStep' | 'retryCount' | 'maxRetries'>
  ) => void;
  markSubgraph: (task: TaskRecord, subgraphId: 'review') => void;
  markWorkerUsage: (task: TaskRecord, workerId?: string) => void;
  addTrace: (task: TaskRecord, node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  addMessage: (task: TaskRecord, type: 'review_result' | 'summary', content: string, from: AgentRole) => void;
  upsertAgentState: (task: TaskRecord, nextState: unknown) => void;
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
  transitionQueueState: (
    task: TaskRecord,
    status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'blocked'
  ) => void;
  resolveReviewMinistry: (
    task: TaskRecord,
    workflow?: TaskRecord['resolvedWorkflow']
  ) => 'xingbu-review' | 'libu-delivery';
  getMinistryLabel: (ministry: string) => string;
  reviewExecution: (
    task: TaskRecord,
    xingbu: XingbuReviewMinistry,
    executionResult: RuntimeAgentGraphState['executionResult'],
    executionSummary: string
  ) => Promise<{
    review: ReviewRecord;
    evaluation: EvaluationResult;
    critiqueResult?: TaskRecord['critiqueResult'];
    specialistFinding?: NonNullable<TaskRecord['specialistFindings']>[number];
    contractMeta: StructuredContractMeta;
  }>;
  persistReviewArtifacts: (
    task: TaskRecord,
    goal: string,
    evaluation: EvaluationResult,
    review: ReviewRecord,
    executionSummary: string
  ) => Promise<void>;
  enqueueTaskLearning: (task: TaskRecord, userFeedback?: string) => void;
  shouldRunLibuDocsDelivery: (workflow?: TaskRecord['resolvedWorkflow']) => boolean;
  buildFreshnessSourceSummary: (task: TaskRecord) => string | undefined;
  buildCitationSourceSummary: (task: TaskRecord) => string | undefined;
  appendDiagnosisEvidence: (
    task: TaskRecord,
    review: ReviewRecord,
    executionSummary: string,
    finalAnswer: string
  ) => void;
}

export async function runReviewStage(
  task: TaskRecord,
  dtoGoal: string,
  state: RuntimeAgentGraphState,
  libu: LibuRouterMinistry,
  libuDocs: LibuDocsMinistry,
  xingbu: XingbuReviewMinistry,
  callbacks: ReviewCallbacks
): Promise<Partial<RuntimeAgentGraphState>> {
  callbacks.ensureTaskNotCancelled(task);
  markExecutionStepStarted(task, 'review', '刑部开始终审与放行判断。', 'xingbu');
  callbacks.syncTaskRuntime(task, {
    currentStep: 'review',
    retryCount: state.retryCount,
    maxRetries: state.maxRetries
  });
  callbacks.markSubgraph(task, 'review');
  task.mainChainNode = 'result_aggregator';
  task.currentNode = 'review_and_govern';
  const reviewMinistry = callbacks.resolveReviewMinistry(task, task.resolvedWorkflow);
  task.currentMinistry = reviewMinistry;
  task.currentWorker = task.modelRoute?.find(item => item.ministry === reviewMinistry)?.workerId;
  callbacks.markWorkerUsage(task, task.currentWorker);
  callbacks.addTrace(task, 'ministry_started', `${callbacks.getMinistryLabel(reviewMinistry)}开始审查与交付整理。`, {
    ministry: task.currentMinistry,
    workerId: task.currentWorker
  });
  callbacks.addProgressDelta(
    task,
    `${callbacks.getMinistryLabel(reviewMinistry)}开始审查并整理交付。`,
    AgentRole.REVIEWER
  );

  const reviewed: NormalizedReviewResult =
    reviewMinistry === 'libu-delivery'
      ? {
          ...libuDocs.review(task, state.executionSummary ?? task.result ?? 'No execution summary available.'),
          critiqueResult: undefined,
          specialistFinding: undefined,
          contractMeta: {
            contractName: 'review-decision',
            contractVersion: 'review-decision.v1',
            parseStatus: 'success',
            fallbackUsed: false
          }
        }
      : await callbacks.reviewExecution(
          task,
          xingbu,
          state.executionResult,
          state.executionSummary ?? task.result ?? 'No execution summary available.'
        );
  callbacks.ensureTaskNotCancelled(task);

  const critiqueDecision = deriveFinalReviewDecision(task, reviewed.review, reviewed.evaluation.shouldRetry);
  task.critiqueResult = normalizeCritiqueResult({
    ...reviewed.critiqueResult,
    decision: critiqueDecision,
    summary: buildFinalReviewSummary(task, reviewed.critiqueResult?.summary, critiqueDecision),
    blockingIssues:
      reviewed.critiqueResult?.blockingIssues ?? (reviewed.review.decision === 'blocked' ? reviewed.review.notes : []),
    constraints: reviewed.critiqueResult?.constraints ?? reviewed.evaluation.notes,
    evidenceRefs: reviewed.critiqueResult?.evidenceRefs ?? task.externalSources?.slice(0, 5).map(source => source.id),
    shouldBlockEarly: reviewed.critiqueResult?.shouldBlockEarly ?? critiqueDecision === 'block'
  });
  task.criticState = {
    node: 'critic',
    decision: critiqueDecision === 'pass' ? 'pass_through' : 'rewrite_required',
    summary: critiqueDecision === 'pass' ? '批判层允许聚合稿进入刑部终审。' : '批判层要求回流调度链做修订或阻断处理。',
    blockingIssues: task.critiqueResult.blockingIssues,
    createdAt: task.criticState?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  task.finalReviewState = {
    node: 'final_review',
    ministry: reviewMinistry,
    decision: critiqueDecision === 'needs_human_approval' ? 'revise_required' : critiqueDecision,
    summary: task.critiqueResult.summary,
    interruptRequired: critiqueDecision !== 'pass',
    deliveryStatus: critiqueDecision === 'pass' ? 'pending' : 'interrupted',
    deliveryMinistry: 'libu-delivery',
    createdAt: task.finalReviewState?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  task.microLoopState = {
    state: 'idle',
    attempt: task.microLoopCount ?? 0,
    maxAttempts: task.maxMicroLoops ?? 0,
    updatedAt: new Date().toISOString()
  };
  task.guardrailState = {
    stage: 'post',
    verdict: critiqueDecision === 'pass' ? 'pass_through' : critiqueDecision === 'block' ? 'block' : 'rewrite_required',
    summary:
      critiqueDecision === 'pass'
        ? '出站护栏通过，允许礼部交付。'
        : critiqueDecision === 'block'
          ? '出站护栏阻断当前稿件。'
          : '出站护栏要求先修订再交付。',
    updatedAt: new Date().toISOString()
  };
  task.sandboxState = {
    ...(task.sandboxState ?? {
      node: 'sandbox',
      stage: 'review',
      status: 'idle',
      attempt: task.microLoopCount ?? 0,
      maxAttempts: task.maxMicroLoops ?? 0,
      updatedAt: new Date().toISOString()
    }),
    stage: 'review',
    status: critiqueDecision === 'block' ? 'failed' : (task.sandboxState?.status ?? 'passed'),
    verdict: critiqueDecision === 'block' ? 'unsafe' : (task.sandboxState?.verdict ?? 'safe'),
    exhaustedReason: critiqueDecision === 'block' ? 'final_review_blocked' : task.sandboxState?.exhaustedReason,
    updatedAt: new Date().toISOString()
  };
  callbacks.addTrace(task, 'result_aggregator', '汇总票拟已接收策略、执行证据与终审意见。', {
    strategyCounselors: task.executionPlan?.strategyCounselors ?? [],
    executionMinistries: task.executionPlan?.executionMinistries ?? [],
    critiqueDecision
  });
  callbacks.addTrace(task, 'final_review_gate', '刑部终审门已完成本轮放行判断。', {
    decision: task.finalReviewState.decision,
    interruptRequired: task.finalReviewState.interruptRequired
  });
  if (task.finalReviewState.interruptRequired) {
    markExecutionStepBlocked(task, 'review', task.finalReviewState.summary, '终审要求阻断或修订。', 'xingbu');
    markExecutionStepBlocked(
      task,
      'approval-interrupt',
      '终审链已触发阻断处理。',
      '等待司礼监处理后续阻断或修订。',
      'system'
    );
    task.mainChainNode = 'interrupt_controller';
    task.currentNode = 'final_review_interrupted';
    callbacks.addTrace(task, 'interrupt_controller', '司礼监已接收刑部终审阻断/修订结论。', {
      finalReviewDecision: task.finalReviewState.decision,
      deliveryStatus: task.finalReviewState.deliveryStatus
    });
    callbacks.addProgressDelta(
      task,
      `刑部终审结论为 ${task.finalReviewState.decision}，已转入司礼监处理后续阻断或修订。`
    );
  }
  if (task.specialistLead) {
    upsertSpecialistFinding(task, {
      specialistId: task.specialistLead.id,
      role: 'lead',
      source: 'critique',
      stage: 'review',
      domain: task.specialistLead.domain,
      summary: state.executionSummary ?? task.result ?? '主导专家正在整理最终结论。',
      riskLevel: reviewed.review.decision === 'blocked' ? 'high' : reviewed.evaluation.shouldRetry ? 'medium' : 'low',
      constraints: reviewed.evaluation.notes,
      blockingIssues: reviewed.review.decision === 'blocked' ? reviewed.review.notes : [],
      evidenceRefs: task.externalSources?.slice(0, 5).map(source => source.id),
      confidence: task.routeConfidence
    });
  }
  if (
    (task.supportingSpecialists ?? []).some(item => item.id === 'risk-compliance') ||
    task.specialistLead?.id === 'risk-compliance'
  ) {
    upsertSpecialistFinding(
      task,
      reviewed.specialistFinding ?? {
        specialistId: 'risk-compliance',
        role: task.specialistLead?.id === 'risk-compliance' ? 'lead' : 'support',
        source: 'critique',
        stage: 'review',
        domain: 'risk-compliance',
        summary: task.critiqueResult.summary,
        riskLevel:
          task.critiqueResult.decision === 'block'
            ? 'critical'
            : task.critiqueResult.decision === 'revise_required'
              ? 'high'
              : task.critiqueResult.decision === 'needs_human_approval'
                ? 'medium'
                : 'low',
        blockingIssues: task.critiqueResult.blockingIssues,
        constraints: task.critiqueResult.constraints,
        evidenceRefs: task.critiqueResult.evidenceRefs
      }
    );
  }

  if (reviewed.evaluation.shouldRetry) {
    const nextRevisionCount = (task.revisionCount ?? 0) + 1;
    const maxRevisions = task.maxRevisions ?? 2;
    const nextMicroLoopCount = (task.microLoopCount ?? 0) + 1;
    const maxMicroLoops = task.maxMicroLoops ?? 2;
    task.microLoopCount = nextMicroLoopCount;
    task.revisionState = 'needs_revision';
    task.microLoopState = {
      state: 'retrying',
      attempt: nextMicroLoopCount,
      maxAttempts: maxMicroLoops,
      updatedAt: new Date().toISOString()
    };
    task.mainChainNode = 'interrupt_controller';
    callbacks.addTrace(task, 'interrupt_controller', '司礼监已登记 revise-required 回流。', {
      interactionKind: 'revise-required',
      revisionCount: nextRevisionCount,
      microLoopCount: nextMicroLoopCount
    });
    if (nextMicroLoopCount > maxMicroLoops) {
      task.revisionState = 'blocked';
      task.microLoopState = {
        state: 'exhausted',
        attempt: nextMicroLoopCount,
        maxAttempts: maxMicroLoops,
        exhaustedReason: 'micro-loop-exhausted',
        updatedAt: new Date().toISOString()
      };
      task.sandboxState = {
        ...(task.sandboxState ?? {
          node: 'sandbox',
          stage: 'review',
          status: 'exhausted',
          attempt: nextMicroLoopCount,
          maxAttempts: maxMicroLoops,
          updatedAt: new Date().toISOString()
        }),
        status: 'exhausted',
        verdict: 'unsafe',
        attempt: nextMicroLoopCount,
        maxAttempts: maxMicroLoops,
        exhaustedReason: 'micro-loop-exhausted',
        updatedAt: new Date().toISOString()
      };
      callbacks.addTrace(task, 'interrupt_controller', '工兵微循环已耗尽，转入统一中断治理。', {
        interactionKind: 'micro-loop-exhausted',
        microLoopCount: nextMicroLoopCount,
        maxMicroLoops
      });
    }
    if (nextRevisionCount <= maxRevisions && state.retryCount < state.maxRetries) {
      task.revisionCount = nextRevisionCount;
      task.status = TaskStatus.RUNNING;
      task.revisionState = 'revising';
      task.microLoopState = {
        state: 'retrying',
        attempt: nextMicroLoopCount,
        maxAttempts: maxMicroLoops,
        updatedAt: new Date().toISOString()
      };
      callbacks.transitionQueueState(task, 'running');
      task.result = undefined;
      callbacks.syncTaskRuntime(task, {
        currentStep: 'manager_plan',
        retryCount: state.retryCount + 1,
        maxRetries: state.maxRetries
      });
      callbacks.addTrace(
        task,
        'manager_replan',
        `Reviewer requested retry ${state.retryCount + 1}/${state.maxRetries}`,
        {
          critiqueDecision: task.critiqueResult.decision,
          revisionCount: task.revisionCount,
          maxRevisions
        }
      );
      markExecutionStepCompleted(task, 'review', '终审要求回流重规划。', 'xingbu');
      await callbacks.persistAndEmitTask(task);
      return {
        currentStep: 'review',
        evaluation: reviewed.evaluation,
        reviewDecision: reviewed.review.decision,
        shouldRetry: true,
        retryCount: state.retryCount + 1,
        approvalRequired: false,
        approvalStatus: undefined,
        executionResult: undefined,
        executionSummary: undefined,
        finalAnswer: undefined,
        toolIntent: undefined,
        toolName: undefined,
        researchSummary: undefined,
        dispatches: []
      };
    }

    callbacks.addTrace(task, 'critique_guard_triggered', '已达到最大修订次数，礼部将带风险提示输出半成品。', {
      critiqueDecision: task.critiqueResult.decision,
      revisionCount: nextRevisionCount,
      maxRevisions
    });
    task.revisionCount = nextRevisionCount;
    task.revisionState = 'blocked';
    task.microLoopState = {
      state: 'exhausted',
      attempt: task.microLoopCount ?? 0,
      maxAttempts: task.maxMicroLoops ?? 0,
      exhaustedReason: 'revise-required-blocked',
      updatedAt: new Date().toISOString()
    };
    reviewed.review.notes = [...reviewed.review.notes, '核心审查未通过，以下建议仅供参考，请谨慎执行。'];
  }

  const executionSummaryForPersistence = resolveExecutionSummaryForPersistence(
    task,
    state.executionSummary ?? task.result ?? ''
  );
  if (executionSummaryForPersistence.wasCompacted) {
    callbacks.addTrace(task, 'context_compaction_retried', '执行摘要过长，已触发应急压缩后再进入学习沉淀。', {
      reactiveRetryCount: executionSummaryForPersistence.compression.reactiveRetryCount,
      compactedCharacterCount: executionSummaryForPersistence.compression.compactedCharacterCount,
      originalCharacterCount: executionSummaryForPersistence.compression.originalCharacterCount
    });
  }

  await callbacks.persistReviewArtifacts(
    task,
    dtoGoal,
    reviewed.evaluation,
    reviewed.review,
    executionSummaryForPersistence.summary
  );
  callbacks.enqueueTaskLearning(task);
  callbacks.addTrace(task, 'background_learning_queued', '学习沉淀已转入后台队列，最终答复不会等待异步整理完成。', {
    learningQueueItemId: task.learningQueueItemId,
    mode: task.backgroundLearningState?.mode ?? 'task-learning'
  });
  task.mainChainNode = 'learning_recorder';
  task.evaluationReport = {
    id: task.libuEvaluationReportId ?? `eval_${task.id}`,
    ministry: 'libu-governance',
    score: task.learningEvaluation?.score ?? 0,
    summary: reviewed.evaluation.notes.join('；') || '吏部已完成评分与 RLAIF 摘要。',
    rlaifNotes: reviewed.evaluation.notes,
    derivedFromTaskId: task.id,
    derivedFromTraceId: task.traceId,
    createdAt: task.evaluationReport?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  task.libuEvaluationReportId = task.evaluationReport.id;
  task.governanceScore = buildGovernanceScore(task, reviewed.evaluation);
  task.governanceReport = buildGovernanceReport(task, reviewed.evaluation, task.governanceScore);
  applyCapabilityTrustFromGovernance(task);
  const docsSummary =
    task.finalReviewState.decision === 'pass' && callbacks.shouldRunLibuDocsDelivery(task.resolvedWorkflow)
      ? libuDocs.buildDelivery(task, state.executionSummary ?? task.result ?? 'No execution summary available.')
      : undefined;
  if (docsSummary) {
    callbacks.addTrace(task, 'ministry_reported', docsSummary, { ministry: 'libu-delivery' });
    callbacks.addMessage(task, 'review_result', docsSummary, AgentRole.REVIEWER);
    callbacks.addProgressDelta(task, docsSummary, AgentRole.REVIEWER);
  }
  const stitchedSummary = docsSummary
    ? `${state.executionSummary ?? task.result ?? ''}\n${docsSummary}`
    : (state.executionSummary ?? task.result ?? 'No execution summary available.');
  if (task.finalReviewState.decision === 'pass') {
    callbacks.addTrace(task, 'delivery_gate', '礼部交付门已接收终审放行结果，开始整理最终答复。', {
      deliveryMinistry: 'libu-delivery'
    });
  }
  const finalAnswer = await libu.finalize(
    reviewed.review,
    stitchedSummary,
    callbacks.buildFreshnessSourceSummary(task),
    callbacks.buildCitationSourceSummary(task)
  );
  const finalAnswerWithGuard =
    reviewed.evaluation.shouldRetry && (task.revisionCount ?? 0) > (task.maxRevisions ?? 2)
      ? `⚠️ 核心审查未通过，以下策略仅供参考，请谨慎执行。\n\n${finalAnswer}`
      : finalAnswer;
  callbacks.ensureTaskNotCancelled(task);
  callbacks.appendDiagnosisEvidence(task, reviewed.review, stitchedSummary, finalAnswerWithGuard);
  callbacks.upsertAgentState(task, libu.getState());
  callbacks.addMessage(task, 'summary', finalAnswerWithGuard, AgentRole.MANAGER);
  markExecutionStepCompleted(
    task,
    'review',
    task.critiqueResult.summary,
    reviewMinistry === 'libu-delivery' ? 'libu-docs' : 'xingbu'
  );
  markExecutionStepCompleted(task, 'delivery', docsSummary ?? '礼部已整理最终答复。', 'libu-docs');
  callbacks.addTrace(task, 'finish', finalAnswerWithGuard, {
    critiqueDecision: task.critiqueResult.decision,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    status: reviewed.contractMeta.parseStatus === 'success' ? 'success' : 'failed',
    isFallback: reviewed.contractMeta.fallbackUsed,
    fallbackReason: reviewed.contractMeta.fallbackReason,
    contractName: reviewed.contractMeta.contractName,
    contractVersion: reviewed.contractMeta.contractVersion,
    parseStatus: reviewed.contractMeta.parseStatus
  });

  task.result = finalAnswerWithGuard;
  task.status = reviewed.review.decision === 'approved' ? TaskStatus.COMPLETED : TaskStatus.FAILED;
  callbacks.transitionQueueState(task, reviewed.review.decision === 'approved' ? 'completed' : 'failed');
  task.skillStage = 'completed';
  task.currentNode = 'finalize_response';
  task.updatedAt = new Date().toISOString();
  task.finalReviewState = {
    ...task.finalReviewState,
    deliveryStatus: task.finalReviewState.decision === 'pass' ? 'delivered' : 'interrupted',
    deliveryMinistry: 'libu-delivery',
    updatedAt: new Date().toISOString()
  };
  callbacks.addTrace(task, 'ministry_reported', '刑部已提交审查结论。', {
    ministry: task.currentMinistry,
    workerId: task.currentWorker,
    decision: reviewed.review.decision
  });
  callbacks.addTrace(task, 'final_response_completed', '首辅已汇总最终答复。', { currentNode: task.currentNode });
  callbacks.addProgressDelta(task, '首辅正在整理最终答复。');
  callbacks.addTrace(
    task,
    'skill_stage_completed',
    `流程模板 ${task.resolvedWorkflow?.displayName ?? '通用协作'} 已完成。`,
    {
      skillId: task.skillId,
      skillStage: task.skillStage,
      outputType: task.resolvedWorkflow?.outputContract.type
    }
  );
  if (!reviewed.evaluation.shouldRetry) {
    task.revisionState = 'completed';
    task.microLoopState = {
      state: 'completed',
      attempt: task.microLoopCount ?? 0,
      maxAttempts: task.maxMicroLoops ?? 0,
      updatedAt: new Date().toISOString()
    };
  }
  await callbacks.persistAndEmitTask(task);

  return {
    currentStep: 'review',
    evaluation: reviewed.evaluation,
    reviewDecision: reviewed.review.decision,
    shouldRetry: false,
    finalAnswer
  };
}

function resolveExecutionSummaryForPersistence(task: TaskRecord, executionSummary: string) {
  const shouldCompact =
    executionSummary.length > 1200 || /(stderr|stdout|stack|trace|error|failed|exception)/i.test(executionSummary);
  const existingSlice = task.contextFilterState?.filteredContextSlice;
  const baseCompression = existingSlice
    ? {
        summary: existingSlice.summary,
        compressionApplied: existingSlice.compressionApplied ?? false,
        compressionSource: existingSlice.compressionSource ?? ('heuristic' as const),
        compressedMessageCount: existingSlice.compressedMessageCount ?? 0,
        artifactCount: existingSlice.artifactCount ?? 0,
        originalCharacterCount: existingSlice.originalCharacterCount ?? executionSummary.length,
        compactedCharacterCount: existingSlice.compactedCharacterCount ?? existingSlice.summary.length,
        reactiveRetryCount: existingSlice.reactiveRetryCount ?? 0,
        pipelineAudit: existingSlice.pipelineAudit ?? []
      }
    : buildContextCompressionResult({
        goal: task.goal,
        context: executionSummary,
        planDraft: task.planDraft,
        plan: task.plan,
        trace: task.trace
      });
  if (!shouldCompact) {
    return {
      summary: executionSummary,
      wasCompacted: false,
      compression: baseCompression
    };
  }
  const compacted = applyReactiveCompactRetry(baseCompression, 'review-stage', '执行摘要已压缩。');
  if (task.contextFilterState) {
    task.contextFilterState.filteredContextSlice = {
      ...task.contextFilterState.filteredContextSlice,
      summary: compacted.summary,
      compressionApplied: compacted.compressionApplied,
      compressionSource: compacted.compressionSource,
      compressedMessageCount: compacted.compressedMessageCount,
      artifactCount: compacted.artifactCount,
      originalCharacterCount: compacted.originalCharacterCount,
      compactedCharacterCount: compacted.compactedCharacterCount,
      reactiveRetryCount: compacted.reactiveRetryCount,
      pipelineAudit: compacted.pipelineAudit
    };
  }
  return {
    summary: compacted.summary || executionSummary,
    wasCompacted: true,
    compression: compacted
  };
}
