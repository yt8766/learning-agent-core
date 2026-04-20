import type { TaskRecord } from '@agent/core';

export function buildRecentTraceSummaryLines(task: Pick<TaskRecord, 'trace'>, limit = 5) {
  return task.trace.slice(-limit).map(trace => `${trace.at} / ${trace.node} / ${trace.summary}`);
}
