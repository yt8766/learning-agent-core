import { NotFoundException } from '@nestjs/common';

import type { TaskRecord } from '@agent/core';

export function buildRecentTraceSummaryLines(task: Pick<TaskRecord, 'trace'>, limit = 5) {
  return task.trace.slice(-limit).map(trace => `${trace.at} / ${trace.node} / ${trace.summary}`);
}

export function assertTaskActionResult<TTask>(taskId: string, task: TTask | undefined): TTask {
  if (!task) {
    throw new NotFoundException(`Task ${taskId} not found`);
  }
  return task;
}
