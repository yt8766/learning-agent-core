import type { RunCheckpointSummaryRecord, RunInterruptLedgerItemRecord, RunTraceSpanRecord } from '@agent/core';

import { findLatestCheckpoint, findNearestTraceAtOrBefore, resolveRelatedStage } from './run-linking';
import type { RuntimeObservabilityTaskLike } from './runtime-observability.types';

function mapInterruptKind(kind?: string): RunInterruptLedgerItemRecord['kind'] {
  if (kind === 'user-input') {
    return 'supplemental_input';
  }
  if (kind === 'reject') {
    return 'reject';
  }
  if (kind === 'recover') {
    return 'recover';
  }
  return 'approval';
}

function mapInterruptStatus(status?: string): RunInterruptLedgerItemRecord['status'] {
  if (status === 'resolved' || status === 'approved') {
    return 'resolved';
  }
  if (status === 'timed_out') {
    return 'timed_out';
  }
  if (status === 'cancelled' || status === 'rejected') {
    return 'cancelled';
  }
  return 'pending';
}

function toLedgerItem(
  item: NonNullable<RuntimeObservabilityTaskLike['activeInterrupt']>,
  fallbackId: string,
  traces: RunTraceSpanRecord[],
  checkpoints: RunCheckpointSummaryRecord[]
): RunInterruptLedgerItemRecord {
  const kind = mapInterruptKind(item.kind);
  const status = mapInterruptStatus(item.status);
  const relatedTrace = findNearestTraceAtOrBefore(traces, item.createdAt);
  const relatedCheckpoint = findLatestCheckpoint(checkpoints);
  const headline = item.intent ?? item.reason ?? item.toolName;
  return {
    id: item.id ?? fallbackId,
    kind,
    status,
    title: kind === 'supplemental_input' ? '等待补充输入' : '审批中断',
    summary:
      status === 'pending'
        ? kind === 'supplemental_input'
          ? headline
            ? `当前 run 需要额外的人类输入：${headline}`
            : '当前 run 需要额外的人类输入'
          : headline
            ? `当前 run 正在等待人工审批：${headline}`
            : '当前 run 正在等待人工审批'
        : (item.reason ?? '该中断已处理完成'),
    createdAt: item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
    resolvedAt: status === 'resolved' ? item.updatedAt : undefined,
    stage:
      status === 'pending'
        ? 'interrupt'
        : resolveRelatedStage({
            trace: relatedTrace,
            checkpoint: relatedCheckpoint
          }),
    relatedCheckpointId: relatedCheckpoint?.checkpointId,
    relatedSpanId: relatedTrace?.spanId,
    feedback: item.feedback
  };
}

export function buildRunInterruptLedger(
  task: RuntimeObservabilityTaskLike,
  traces: RunTraceSpanRecord[],
  checkpoints: RunCheckpointSummaryRecord[]
): RunInterruptLedgerItemRecord[] {
  const active = task.activeInterrupt
    ? [toLedgerItem(task.activeInterrupt, `${task.id}-active-interrupt`, traces, checkpoints)]
    : [];
  const history = (task.interruptHistory ?? []).map((item, index) =>
    toLedgerItem(item, `${task.id}-interrupt-${index}`, traces, checkpoints)
  );
  return [...history, ...active].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
