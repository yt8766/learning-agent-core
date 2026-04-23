import { NotFoundException } from '@nestjs/common';

export { buildRecentTraceSummaryLines } from '../../core/runtime-centers-facade';

export function assertTaskActionResult<TTask>(taskId: string, task: TTask | undefined): TTask {
  if (!task) {
    throw new NotFoundException(`Task ${taskId} not found`);
  }
  return task;
}
