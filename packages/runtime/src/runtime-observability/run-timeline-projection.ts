import type { RunTimelineItemRecord, RunTraceSpanRecord, RunInterruptLedgerItemRecord } from '@agent/core';

import type { RuntimeObservabilityTaskLike } from './runtime-observability.types';
import { resolveRunStage } from './run-stage-semantics';

function stageStatusFromTraceStatus(status?: RunTraceSpanRecord['status']): RunTimelineItemRecord['status'] {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'blocked';
    case 'cancelled':
      return 'blocked';
    default:
      return 'running';
  }
}

function stageTitle(stage: RunTimelineItemRecord['stage']) {
  switch (stage) {
    case 'plan':
      return '任务规划';
    case 'route':
      return '任务路由';
    case 'research':
      return '户部研究';
    case 'execution':
      return '工部/兵部执行';
    case 'review':
      return '刑部审查';
    case 'delivery':
      return '礼部交付';
    case 'interrupt':
      return '中断与审批';
    case 'recover':
      return '恢复执行';
    case 'learning':
      return '学习沉淀';
  }
}

export function buildRunTimeline(
  task: RuntimeObservabilityTaskLike,
  traces: RunTraceSpanRecord[],
  interrupts: RunInterruptLedgerItemRecord[]
): RunTimelineItemRecord[] {
  const items = new Map<RunTimelineItemRecord['stage'], RunTimelineItemRecord>();

  for (const trace of traces) {
    const existing = items.get(trace.stage);
    if (existing) {
      existing.linkedSpanIds = [...(existing.linkedSpanIds ?? []), trace.spanId];
      existing.endedAt = trace.endedAt ?? existing.endedAt;
      existing.durationMs = (existing.durationMs ?? 0) + (trace.latencyMs ?? 0);
      if (stageStatusFromTraceStatus(trace.status) === 'failed') {
        existing.status = 'failed';
      } else if (stageStatusFromTraceStatus(trace.status) === 'blocked' && existing.status !== 'failed') {
        existing.status = 'blocked';
      }
      continue;
    }

    items.set(trace.stage, {
      id: `${task.id}:${trace.stage}`,
      stage: trace.stage,
      status: stageStatusFromTraceStatus(trace.status),
      title: stageTitle(trace.stage),
      summary: trace.summary,
      startedAt: trace.startedAt,
      endedAt: trace.endedAt,
      durationMs: trace.latencyMs,
      linkedSpanIds: [trace.spanId]
    });
  }

  if (interrupts.length) {
    const interrupt = interrupts.at(-1);
    if (!interrupt) {
      return [...items.values()].sort((left, right) => (left.startedAt ?? '').localeCompare(right.startedAt ?? ''));
    }
    items.set('interrupt', {
      id: `${task.id}:interrupt`,
      stage: 'interrupt',
      status: interrupt.status === 'pending' ? 'blocked' : 'completed',
      title: stageTitle('interrupt'),
      summary: interrupt.summary,
      startedAt: interrupt.createdAt,
      endedAt: interrupt.resolvedAt,
      linkedInterruptIds: [interrupt.id]
    });
  }

  if (!items.size) {
    const stage = resolveRunStage({
      currentNode: task.currentNode,
      currentStep: task.currentStep,
      currentMinistry: task.currentMinistry
    });
    items.set(stage, {
      id: `${task.id}:${stage}`,
      stage,
      status: task.status === 'failed' ? 'failed' : task.status === 'blocked' ? 'blocked' : 'running',
      title: stageTitle(stage),
      summary: task.currentStep ?? task.currentNode ?? task.goal,
      startedAt: task.createdAt,
      endedAt: task.status === 'completed' ? task.updatedAt : undefined
    });
  }

  return [...items.values()].sort((left, right) => (left.startedAt ?? '').localeCompare(right.startedAt ?? ''));
}
