import type { EvaluationResult } from '@agent/core';
import type { GovernanceReportRecord } from '@agent/core';
import type { RuntimeTaskRecord } from '../../runtime/runtime-task.types';

function toGovernanceReviewDecision(
  decision: NonNullable<RuntimeTaskRecord['critiqueResult']>['decision']
): GovernanceReportRecord['reviewOutcome']['decision'] {
  return decision === 'block' ? 'blocked' : decision;
}

function toCritiqueDecision(
  decision: GovernanceReportRecord['reviewOutcome']['decision']
): 'pass' | 'revise_required' | 'block' | 'needs_human_approval' {
  if (decision === 'blocked') {
    return 'block';
  }
  if (decision === 'approved' || decision === 'retry') {
    return 'pass';
  }
  return decision;
}

function clampGovernanceScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildGovernanceScore(
  task: RuntimeTaskRecord,
  evaluation: EvaluationResult
): NonNullable<RuntimeTaskRecord['governanceScore']> {
  let score = task.learningEvaluation?.score ?? 72;
  const rationale: string[] = [];
  const recommendedLearningTargets: Array<'memory' | 'rule' | 'skill'> = [];

  if (task.critiqueResult?.decision === 'pass') {
    score += 12;
    rationale.push('刑部终审通过，本轮执行可作为稳定样本。');
  } else if (task.critiqueResult?.decision === 'needs_human_approval') {
    score -= 8;
    rationale.push('刑部认为仍需人工审批后再放行。');
  } else if (task.critiqueResult?.decision === 'revise_required') {
    score -= 18;
    rationale.push('刑部要求继续修订，本轮结果暂不宜直接提升信任。');
  } else if (task.critiqueResult?.decision === 'block') {
    score -= 32;
    rationale.push('刑部判定存在阻断问题，需降低本轮治理信心。');
  }

  if ((task.microLoopCount ?? 0) > 0) {
    score -= Math.min(18, (task.microLoopCount ?? 0) * 6);
    rationale.push(`工兵微循环已触发 ${task.microLoopCount} 次。`);
  }
  if ((task.pendingApproval || task.activeInterrupt) && task.critiqueResult?.decision !== 'pass') {
    score -= 6;
    rationale.push('当前链路仍依赖司礼监中断治理或审批恢复。');
  }
  if (task.learningEvaluation?.conflictDetected) {
    score -= 10;
    rationale.push('学习沉淀检测到冲突，建议保守处理。');
  }
  if (evaluation.shouldWriteMemory) {
    recommendedLearningTargets.push('memory');
  }
  if (evaluation.shouldCreateRule) {
    recommendedLearningTargets.push('rule');
  }
  if (evaluation.shouldExtractSkill) {
    recommendedLearningTargets.push('skill');
  }
  if (recommendedLearningTargets.length > 0 && task.critiqueResult?.decision === 'pass') {
    score += 5;
    rationale.push('本轮结果满足进一步沉淀 memory/rule/skill 的条件。');
  }

  const normalizedScore = clampGovernanceScore(score);
  const status = normalizedScore >= 80 ? 'healthy' : normalizedScore >= 60 ? 'watch' : 'risky';
  const trustAdjustment = status === 'healthy' ? 'promote' : status === 'risky' ? 'downgrade' : 'hold';

  return {
    ministry: 'libu-governance',
    score: normalizedScore,
    status,
    summary:
      status === 'healthy'
        ? `吏部认为本轮执行质量稳健，可作为高置信沉淀样本（${normalizedScore} 分）。`
        : status === 'watch'
          ? `吏部认为本轮结果可保守复用，但仍需关注修订/审批信号（${normalizedScore} 分）。`
          : `吏部认为本轮结果风险较高，建议降低能力信任并优先人工复核（${normalizedScore} 分）。`,
    rationale,
    recommendedLearningTargets,
    trustAdjustment,
    updatedAt: new Date().toISOString()
  };
}

export function buildGovernanceReport(
  task: RuntimeTaskRecord,
  evaluation: EvaluationResult,
  governanceScore: NonNullable<RuntimeTaskRecord['governanceScore']>
): GovernanceReportRecord {
  const reviewDecision = toGovernanceReviewDecision(task.critiqueResult?.decision ?? 'pass');
  const interruptCount = task.interruptHistory?.length ?? 0;
  const microLoopCount = task.microLoopCount ?? 0;
  const executionQualityScore = governanceScore.score;
  const evidenceSufficiencyScore = Math.max(
    0,
    Math.min(100, 55 + (task.externalSources?.length ?? 0) * 8 + (task.reusedMemories?.length ?? 0) * 4)
  );
  const sandboxReliabilityScore =
    task.sandboxState?.status === 'passed'
      ? 90
      : task.sandboxState?.status === 'exhausted'
        ? 35
        : task.sandboxState?.status === 'failed'
          ? 20
          : 60;
  const businessFeedbackScore = evaluation.success ? 82 : reviewDecision === 'blocked' ? 30 : 58;

  return {
    ministry: 'libu-governance',
    summary: governanceScore.summary,
    executionQuality: {
      score: executionQualityScore,
      summary: governanceScore.rationale[0] ?? '已根据终审、修订和预算信号评估执行质量。'
    },
    evidenceSufficiency: {
      score: evidenceSufficiencyScore,
      summary:
        (task.externalSources?.length ?? 0) > 0
          ? `已汇聚 ${task.externalSources?.length ?? 0} 条来源，含文渊阁经验与藏经阁文档证据。`
          : '本轮未沉淀足够来源，后续建议补证。'
    },
    sandboxReliability: {
      score: sandboxReliabilityScore,
      summary:
        task.sandboxState?.status === 'passed'
          ? '演武场执行稳定，safe-exec 未发现额外风险。'
          : task.sandboxState?.status === 'exhausted'
            ? '演武场多次重试后熔断，需关注执行稳定性。'
            : task.sandboxState?.status === 'failed'
              ? '演武场执行失败，需降低相关能力信任。'
              : '演武场暂无稳定 verdict。'
    },
    reviewOutcome: {
      decision: reviewDecision,
      summary: task.finalReviewState?.summary ?? '终审链尚未写入摘要。'
    },
    interruptLoad: {
      interruptCount,
      microLoopCount,
      summary:
        interruptCount > 0 || microLoopCount > 0
          ? `司礼监中断 ${interruptCount} 次，工兵微循环 ${microLoopCount} 次。`
          : '本轮未触发显著中断或微循环负载。'
    },
    businessFeedback: {
      score: businessFeedbackScore,
      summary: evaluation.success
        ? '当前结果满足交付与沉淀条件。'
        : reviewDecision === 'blocked'
          ? '当前结果不满足交付要求，应优先人工复核。'
          : '当前结果可保守复用，但不应过度放大信任。'
    },
    recommendedLearningTargets: governanceScore.recommendedLearningTargets,
    trustAdjustment: governanceScore.trustAdjustment,
    updatedAt: new Date().toISOString()
  };
}

export function applyCapabilityTrustFromGovernance(task: RuntimeTaskRecord) {
  if (!task.capabilityAttachments?.length || !task.governanceReport) {
    return;
  }

  const trustLevel =
    task.governanceReport.trustAdjustment === 'promote'
      ? 'high'
      : task.governanceReport.trustAdjustment === 'downgrade'
        ? 'low'
        : 'medium';
  const trustTrend =
    task.governanceReport.trustAdjustment === 'promote'
      ? 'up'
      : task.governanceReport.trustAdjustment === 'downgrade'
        ? 'down'
        : 'steady';
  const reviewDecision = toCritiqueDecision(task.governanceReport.reviewOutcome.decision);
  const trustAdjustment = task.governanceReport.trustAdjustment;

  task.capabilityAttachments = task.capabilityAttachments.map(attachment => ({
    ...attachment,
    capabilityTrust: {
      trustLevel,
      trustTrend,
      lastGovernanceSummary: task.governanceReport?.summary,
      lastReason: task.governanceReport?.reviewOutcome.summary,
      updatedAt: task.governanceReport?.updatedAt ?? new Date().toISOString()
    },
    governanceProfile: mergeCapabilityGovernanceProfile(attachment.governanceProfile, {
      taskId: task.id,
      reviewDecision,
      trustAdjustment,
      updatedAt: task.governanceReport?.updatedAt ?? new Date().toISOString()
    })
  }));
}

function mergeCapabilityGovernanceProfile(
  current: NonNullable<RuntimeTaskRecord['capabilityAttachments']>[number]['governanceProfile'] | undefined,
  next: {
    taskId: string;
    reviewDecision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  }
) {
  const alreadyRecorded = current?.lastTaskId === next.taskId;
  const recentOutcomes = alreadyRecorded
    ? (current?.recentOutcomes ?? []).map(item =>
        item.taskId === next.taskId
          ? {
              ...item,
              reviewDecision: next.reviewDecision,
              trustAdjustment: next.trustAdjustment,
              updatedAt: next.updatedAt
            }
          : item
      )
    : [
        {
          taskId: next.taskId,
          reviewDecision: next.reviewDecision,
          trustAdjustment: next.trustAdjustment,
          updatedAt: next.updatedAt
        },
        ...(current?.recentOutcomes ?? [])
      ].slice(0, 5);

  return {
    reportCount: (current?.reportCount ?? 0) + (alreadyRecorded ? 0 : 1),
    promoteCount: (current?.promoteCount ?? 0) + (!alreadyRecorded && next.trustAdjustment === 'promote' ? 1 : 0),
    holdCount: (current?.holdCount ?? 0) + (!alreadyRecorded && next.trustAdjustment === 'hold' ? 1 : 0),
    downgradeCount: (current?.downgradeCount ?? 0) + (!alreadyRecorded && next.trustAdjustment === 'downgrade' ? 1 : 0),
    passCount: (current?.passCount ?? 0) + (!alreadyRecorded && next.reviewDecision === 'pass' ? 1 : 0),
    reviseRequiredCount:
      (current?.reviseRequiredCount ?? 0) + (!alreadyRecorded && next.reviewDecision === 'revise_required' ? 1 : 0),
    blockCount: (current?.blockCount ?? 0) + (!alreadyRecorded && next.reviewDecision === 'block' ? 1 : 0),
    lastTaskId: next.taskId,
    lastReviewDecision: next.reviewDecision,
    lastTrustAdjustment: next.trustAdjustment,
    recentOutcomes,
    updatedAt: next.updatedAt
  };
}
