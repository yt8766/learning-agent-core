import type { RunBundleRecord, RunSummaryRecord } from '@agent/core';

import { buildRunCheckpointSummaries } from './run-checkpoint-projection';
import { buildRunDiagnostics } from './run-diagnostics-projection';
import { buildRunInterruptLedger } from './run-interrupt-projection';
import { findLatestCheckpoint, findNearestTraceAtOrBefore, resolveRelatedStage } from './run-linking';
import { resolveRunStage } from './run-stage-semantics';
import { buildRunTimeline } from './run-timeline-projection';
import { buildRunTraceSpans } from './run-trace-projection';
import type { RuntimeObservabilityTaskLike, RuntimeObservabilityCheckpointLike } from './runtime-observability.types';

function normalizeExecutionMode(mode?: string) {
  if (mode === 'planning-readonly') {
    return 'plan';
  }
  if (mode === 'standard') {
    return 'execute';
  }
  if (mode === 'plan' || mode === 'execute' || mode === 'imperial_direct') {
    return mode;
  }
  return undefined;
}

function normalizeRunStatus(task: RuntimeObservabilityTaskLike): RunSummaryRecord['status'] {
  if (task.status === 'waiting_approval') {
    return 'waiting_approval';
  }
  if (task.status === 'blocked') {
    return 'blocked';
  }
  if (
    task.status === 'queued' ||
    task.status === 'running' ||
    task.status === 'completed' ||
    task.status === 'failed'
  ) {
    return task.status;
  }
  if (task.status === 'cancelled') {
    return 'cancelled';
  }
  return 'running';
}

function resolveInteractionKind(task: RuntimeObservabilityTaskLike): RunSummaryRecord['interactionKind'] {
  const payloadInteractionKind = task.activeInterrupt?.payload?.interactionKind;
  if (
    payloadInteractionKind === 'approval' ||
    payloadInteractionKind === 'plan-question' ||
    payloadInteractionKind === 'supplemental-input'
  ) {
    return payloadInteractionKind;
  }
  if (task.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  return task.activeInterrupt ? 'approval' : undefined;
}

function summarizeStatus(
  task: RuntimeObservabilityTaskLike,
  hasDiagnostics: { fallback: boolean; interrupt: boolean }
) {
  const currentStage = resolveRunStage({
    currentNode: task.currentNode,
    currentStep: task.currentStep,
    currentMinistry: task.currentMinistry
  });

  const run: RunSummaryRecord = {
    taskId: task.id,
    sessionId: task.sessionId,
    goal: task.goal,
    lineage: task.lineage,
    status: normalizeRunStatus(task),
    startedAt: task.createdAt,
    endedAt: ['completed', 'failed', 'cancelled'].includes(task.status) ? task.updatedAt : undefined,
    durationMs: Math.max(0, new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()),
    executionMode: normalizeExecutionMode(
      task.executionMode ??
        task.executionPlan?.mode ??
        (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute')
    ),
    interactionKind: resolveInteractionKind(task),
    currentStage,
    currentStep: task.currentStep,
    currentNode: task.currentNode,
    currentMinistry: task.currentMinistry,
    currentWorker: task.currentWorker,
    workflow: task.resolvedWorkflow,
    subgraphTrail: task.subgraphTrail,
    modelRoute: task.modelRoute,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    hasInterrupt: hasDiagnostics.interrupt,
    hasFallback: hasDiagnostics.fallback,
    hasRecoverableCheckpoint: false as boolean,
    hasEvidenceWarning: (task.learningEvaluation?.governanceWarnings?.length ?? 0) > 0,
    diagnosticFlags: []
  };

  return run;
}

export function buildRunBundle(
  task: RuntimeObservabilityTaskLike,
  checkpoint?: RuntimeObservabilityCheckpointLike
): RunBundleRecord {
  const traces = buildRunTraceSpans(task.trace);
  const checkpoints = buildRunCheckpointSummaries(checkpoint);
  const interrupts = buildRunInterruptLedger(task, traces, checkpoints);
  const run = summarizeStatus(task, {
    fallback: traces.some(trace => trace.isFallback),
    interrupt: interrupts.some(interrupt => interrupt.status === 'pending')
  });
  run.hasRecoverableCheckpoint = checkpoints.some(item => item.recoverable);
  const diagnostics = buildRunDiagnostics(task, traces, checkpoints, interrupts, run.hasRecoverableCheckpoint);
  run.diagnosticFlags = diagnostics.map(item => item.kind);
  const latestCheckpoint = findLatestCheckpoint(checkpoints);

  return {
    run,
    timeline: buildRunTimeline(task, traces, interrupts),
    traces,
    checkpoints,
    interrupts,
    diagnostics,
    artifacts: task.result
      ? [
          {
            id: `${task.id}:final-answer`,
            type: 'final_answer',
            title: '最终结果',
            content: task.result,
            createdAt: task.updatedAt
          }
        ]
      : [],
    evidence: (task.externalSources ?? []).map((item, index) => {
      const relatedTrace = findNearestTraceAtOrBefore(traces, item.createdAt);
      return {
        id: item.id ?? `${task.id}:evidence:${index}`,
        title: item.title,
        summary: item.summary ?? 'No evidence summary available',
        sourceType: item.sourceType,
        trustLevel:
          item.trustClass === 'verified' || item.trustClass === 'official'
            ? 'high'
            : item.trustClass === 'trusted'
              ? 'medium'
              : 'low',
        stage: resolveRelatedStage({
          trace: relatedTrace,
          checkpoint: latestCheckpoint,
          fallbackStage: run.currentStage
        }),
        citedAt: item.createdAt,
        linkedSpanId: relatedTrace?.spanId,
        linkedCheckpointId: latestCheckpoint?.checkpointId
      };
    }),
    review: task.governanceReport?.reviewOutcome
      ? {
          decision: task.governanceReport.reviewOutcome.decision,
          summary: task.governanceReport.reviewOutcome.summary
        }
      : undefined,
    learning: task.learningEvaluation
      ? {
          recommendedCandidateIds: task.learningEvaluation.recommendedCandidateIds,
          autoConfirmCandidateIds: task.learningEvaluation.autoConfirmCandidateIds,
          governanceWarnings: task.learningEvaluation.governanceWarnings
        }
      : undefined
  };
}
