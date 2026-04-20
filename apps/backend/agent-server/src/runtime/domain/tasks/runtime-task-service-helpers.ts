import { NotFoundException } from '@nestjs/common';

export { buildRecentTraceSummaryLines } from '@agent/runtime';

export function assertTaskActionResult<TTask>(taskId: string, task: TTask | undefined): TTask {
  if (!task) {
    throw new NotFoundException(`Task ${taskId} not found`);
  }
  return task;
}
