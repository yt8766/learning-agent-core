import type {
  RunCheckpointSummaryRecord,
  RunDiagnosticKind,
  RunDiagnosticRecord,
  RunInterruptLedgerItemRecord,
  RunTraceSpanRecord
} from '@agent/core';

import { findLatestCheckpoint } from './run-linking';
import type { RuntimeObservabilityTaskLike } from './runtime-observability.types';
import { resolveRunStage } from './run-stage-semantics';

function diagnosticId(taskId: string, kind: RunDiagnosticKind) {
  return `${taskId}:${kind}`;
}

export function buildRunDiagnostics(
  task: RuntimeObservabilityTaskLike,
  traces: RunTraceSpanRecord[],
  checkpoints: RunCheckpointSummaryRecord[],
  interrupts: RunInterruptLedgerItemRecord[],
  hasRecoverableCheckpoint: boolean
): RunDiagnosticRecord[] {
  const diagnostics: RunDiagnosticRecord[] = [];
  const fallbackTrace = traces.find(trace => trace.isFallback);
  const latestCheckpoint = findLatestCheckpoint(checkpoints);
  const pendingInterrupt = interrupts.find(interrupt => interrupt.status === 'pending');

  if (pendingInterrupt) {
    diagnostics.push({
      id: diagnosticId(task.id, 'approval_blocked'),
      kind: 'approval_blocked',
      severity: 'warning',
      title: '执行等待人工审批',
      summary: '当前 run 已进入中断态，等待人工确认后才能继续。',
      detectedAt: pendingInterrupt.createdAt,
      linkedStage: pendingInterrupt.stage ?? 'interrupt',
      linkedSpanId: pendingInterrupt.relatedSpanId,
      linkedCheckpointId: pendingInterrupt.relatedCheckpointId,
      suggestedAction: {
        type: 'approve',
        label: '检查审批并继续'
      }
    });
  }

  if (fallbackTrace) {
    diagnostics.push({
      id: diagnosticId(task.id, 'fallback'),
      kind: 'fallback',
      severity: 'warning',
      title: '触发模型回退',
      summary: fallbackTrace.fallbackReason
        ? `执行链发生回退：${fallbackTrace.fallbackReason}`
        : '执行链发生模型或策略回退。',
      detectedAt: fallbackTrace.startedAt,
      linkedStage: fallbackTrace.stage,
      linkedSpanId: fallbackTrace.spanId,
      suggestedAction: {
        type: 'review_trace',
        label: '查看回退链路'
      }
    });
  }

  if (task.status === 'failed' && hasRecoverableCheckpoint) {
    diagnostics.push({
      id: diagnosticId(task.id, 'recoverable_failure'),
      kind: 'recoverable_failure',
      severity: 'error',
      title: '失败但可恢复',
      summary: '当前 run 已失败，但存在可恢复 checkpoint，可从中断前后继续排查。',
      detectedAt: task.updatedAt,
      linkedStage: resolveRunStage({
        currentNode: task.currentNode,
        currentStep: task.currentStep,
        currentMinistry: task.currentMinistry
      }),
      linkedCheckpointId: latestCheckpoint?.recoverable ? latestCheckpoint.checkpointId : undefined,
      suggestedAction: {
        type: 'recover',
        label: '尝试从 checkpoint 恢复'
      }
    });
  }

  if ((task.learningEvaluation?.governanceWarnings?.length ?? 0) > 0) {
    diagnostics.push({
      id: diagnosticId(task.id, 'evidence_insufficient'),
      kind: 'evidence_insufficient',
      severity: 'warning',
      title: '证据充分性不足',
      summary: task.learningEvaluation?.governanceWarnings?.[0] ?? '当前 run 的证据链仍需补强。',
      detectedAt: task.updatedAt,
      linkedStage: 'review',
      suggestedAction: {
        type: 'inspect_evidence',
        label: '检查当前 evidence'
      }
    });
  }

  return diagnostics;
}
