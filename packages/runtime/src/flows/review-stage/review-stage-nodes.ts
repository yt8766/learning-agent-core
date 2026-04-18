import type {
  DeliveryMinistryLike,
  ReviewMinistryLike,
  RouterMinistryLike,
  TaskRecord as CoreTaskRecord
} from '@agent/core';
import { AgentRole, EvaluationResult, ReviewRecord, TaskStatus } from '@agent/core';
import type { RuntimeTaskRecord as TaskRecord } from '../../runtime/runtime-task.types';
import type { RuntimeAgentGraphState } from '../../types/chat-graph';
import {
  markExecutionStepBlocked,
  markExecutionStepCompleted,
  markExecutionStepStarted
} from '../../bridges/supervisor-runtime-bridge';
import {
  applyCapabilityTrustFromGovernance,
  buildGovernanceReport,
  buildGovernanceScore
} from '../ministries/governance-stage-helpers';
import { resolveExecutionSummaryForPersistence } from './review-stage-persistence';
import { applyReviewOutcomeState, recordReviewSpecialistFindings } from './review-stage-state';
import type { NormalizedReviewResult, ReviewCallbacks } from './review-stage.types';

export async function runReviewStage(
  task: TaskRecord,
  dtoGoal: string,
  state: RuntimeAgentGraphState,
  libu: RouterMinistryLike,
  libuDocs: DeliveryMinistryLike,
  xingbu: ReviewMinistryLike,
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
          ...libuDocs.review(
            task as CoreTaskRecord,
            state.executionSummary ?? task.result ?? 'No execution summary available.'
          ),
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

  const critiqueDecision = applyReviewOutcomeState(task, reviewed, reviewMinistry);
  const critiqueResult = task.critiqueResult!;
  const finalReviewState = task.finalReviewState!;
  callbacks.addTrace(task, 'result_aggregator', '汇总票拟已接收策略、执行证据与终审意见。', {
    strategyCounselors: task.executionPlan?.strategyCounselors ?? [],
    executionMinistries: task.executionPlan?.executionMinistries ?? [],
    critiqueDecision
  });
  callbacks.addTrace(task, 'final_review_gate', '刑部终审门已完成本轮放行判断。', {
    decision: finalReviewState.decision,
    interruptRequired: finalReviewState.interruptRequired
  });
  if (finalReviewState.interruptRequired) {
    markExecutionStepBlocked(task, 'review', finalReviewState.summary, '终审要求阻断或修订。', 'xingbu');
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
      finalReviewDecision: finalReviewState.decision,
      deliveryStatus: finalReviewState.deliveryStatus
    });
    callbacks.addProgressDelta(task, `刑部终审结论为 ${finalReviewState.decision}，已转入司礼监处理后续阻断或修订。`);
  }
  recordReviewSpecialistFindings(task, reviewed, state.executionSummary ?? task.result ?? '');

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
          critiqueDecision: critiqueResult.decision,
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
      critiqueDecision: critiqueResult.decision,
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
    finalReviewState.decision === 'pass' && callbacks.shouldRunLibuDocsDelivery(task.resolvedWorkflow)
      ? libuDocs.buildDelivery(
          task as CoreTaskRecord,
          state.executionSummary ?? task.result ?? 'No execution summary available.'
        )
      : undefined;
  if (docsSummary) {
    callbacks.addTrace(task, 'ministry_reported', docsSummary, { ministry: 'libu-delivery' });
    callbacks.addMessage(task, 'review_result', docsSummary, AgentRole.REVIEWER);
    callbacks.addProgressDelta(task, docsSummary, AgentRole.REVIEWER);
  }
  const stitchedSummary = docsSummary
    ? `${state.executionSummary ?? task.result ?? ''}\n${docsSummary}`
    : (state.executionSummary ?? task.result ?? 'No execution summary available.');
  if (finalReviewState.decision === 'pass') {
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
    critiqueResult.summary,
    reviewMinistry === 'libu-delivery' ? 'libu-docs' : 'xingbu'
  );
  markExecutionStepCompleted(task, 'delivery', docsSummary ?? '礼部已整理最终答复。', 'libu-docs');
  callbacks.addTrace(task, 'finish', finalAnswerWithGuard, {
    critiqueDecision: critiqueResult.decision,
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
    ...finalReviewState,
    deliveryStatus: finalReviewState.decision === 'pass' ? 'delivered' : 'interrupted',
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
