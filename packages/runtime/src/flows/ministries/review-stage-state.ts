import { normalizeCritiqueResult, normalizeSpecialistFinding } from '@agent/core';
import type { RuntimeSpecialistFindingRecord as SpecialistFindingRecord } from '../../runtime/runtime-specialist-finding.types';
import type { RuntimeTaskRecord } from '../../runtime/runtime-task.types';
import { buildFinalReviewSummary, deriveFinalReviewDecision } from './review-stage-helpers';
import type { NormalizedReviewResult } from './review-stage.types';

function upsertRuntimeSpecialistFinding(
  task: RuntimeTaskRecord,
  input: Parameters<typeof normalizeSpecialistFinding>[0]
) {
  const finding = normalizeSpecialistFinding(input) as SpecialistFindingRecord;
  const current: SpecialistFindingRecord[] = task.specialistFindings ?? [];
  task.specialistFindings = [
    ...current.filter(item => !(item.specialistId === finding.specialistId && item.role === finding.role)),
    finding
  ];
  return finding;
}

export function applyReviewOutcomeState(
  task: RuntimeTaskRecord,
  reviewed: NormalizedReviewResult,
  reviewMinistry: 'xingbu-review' | 'libu-delivery'
) {
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
  const critiqueResult = task.critiqueResult!;
  const now = new Date().toISOString();

  task.criticState = {
    node: 'critic',
    decision: critiqueDecision === 'pass' ? 'pass_through' : 'rewrite_required',
    summary: critiqueDecision === 'pass' ? '批判层允许聚合稿进入刑部终审。' : '批判层要求回流调度链做修订或阻断处理。',
    blockingIssues: critiqueResult.blockingIssues,
    createdAt: task.criticState?.createdAt ?? now,
    updatedAt: now
  };
  task.finalReviewState = {
    node: 'final_review',
    ministry: reviewMinistry,
    decision: critiqueDecision === 'needs_human_approval' ? 'revise_required' : critiqueDecision,
    summary: critiqueResult.summary,
    interruptRequired: critiqueDecision !== 'pass',
    deliveryStatus: critiqueDecision === 'pass' ? 'pending' : 'interrupted',
    deliveryMinistry: 'libu-delivery',
    createdAt: task.finalReviewState?.createdAt ?? now,
    updatedAt: now
  };
  task.microLoopState = {
    state: 'idle',
    attempt: task.microLoopCount ?? 0,
    maxAttempts: task.maxMicroLoops ?? 0,
    updatedAt: now
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
    updatedAt: now
  };
  task.sandboxState = {
    ...(task.sandboxState ?? {
      node: 'sandbox',
      stage: 'review',
      status: 'idle',
      attempt: task.microLoopCount ?? 0,
      maxAttempts: task.maxMicroLoops ?? 0,
      updatedAt: now
    }),
    stage: 'review',
    status: critiqueDecision === 'block' ? 'failed' : (task.sandboxState?.status ?? 'passed'),
    verdict: critiqueDecision === 'block' ? 'unsafe' : (task.sandboxState?.verdict ?? 'safe'),
    exhaustedReason: critiqueDecision === 'block' ? 'final_review_blocked' : task.sandboxState?.exhaustedReason,
    updatedAt: now
  };

  return critiqueDecision;
}

export function recordReviewSpecialistFindings(
  task: RuntimeTaskRecord,
  reviewed: NormalizedReviewResult,
  executionSummary: string
) {
  const critiqueResult = task.critiqueResult;
  if (!critiqueResult) {
    return;
  }

  if (task.specialistLead) {
    upsertRuntimeSpecialistFinding(task, {
      specialistId: task.specialistLead.id,
      role: 'lead',
      source: 'critique',
      stage: 'review',
      domain: task.specialistLead.domain,
      summary: executionSummary || '主导专家正在整理最终结论。',
      riskLevel: reviewed.review.decision === 'blocked' ? 'high' : reviewed.evaluation.shouldRetry ? 'medium' : 'low',
      constraints: reviewed.evaluation.notes,
      blockingIssues: reviewed.review.decision === 'blocked' ? reviewed.review.notes : [],
      evidenceRefs: task.externalSources?.slice(0, 5).map(source => source.id),
      confidence: task.routeConfidence
    });
  }
  if (
    !(task.supportingSpecialists ?? []).some(item => item.id === 'risk-compliance') &&
    task.specialistLead?.id !== 'risk-compliance'
  ) {
    return;
  }

  upsertRuntimeSpecialistFinding(
    task,
    reviewed.specialistFinding ?? {
      specialistId: 'risk-compliance',
      role: task.specialistLead?.id === 'risk-compliance' ? 'lead' : 'support',
      source: 'critique',
      stage: 'review',
      domain: 'risk-compliance',
      summary: critiqueResult.summary,
      riskLevel:
        critiqueResult.decision === 'block'
          ? 'critical'
          : critiqueResult.decision === 'revise_required'
            ? 'high'
            : critiqueResult.decision === 'needs_human_approval'
              ? 'medium'
              : 'low',
      blockingIssues: critiqueResult.blockingIssues,
      constraints: critiqueResult.constraints,
      evidenceRefs: critiqueResult.evidenceRefs
    }
  );
}
