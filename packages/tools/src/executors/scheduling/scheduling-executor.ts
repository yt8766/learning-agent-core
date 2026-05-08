import type { ToolExecutionRequest } from '@agent/runtime';

import type { ScheduleRepository } from '../../scheduling/schedule-repository';
import { getDefaultScheduleRepository } from '../../scheduling/schedule-repository';

export type SchedulingExecutorOptions = {
  repository?: ScheduleRepository;
};

export async function executeSchedulingTool(request: ToolExecutionRequest, options: SchedulingExecutorOptions = {}) {
  const repository = options.repository ?? getDefaultScheduleRepository();
  if (request.toolName === 'schedule_task') {
    const scheduleName =
      typeof request.input.name === 'string' && request.input.name.trim().length > 0
        ? request.input.name.trim()
        : 'scheduled-task';
    const normalizedId = toScheduleId(scheduleName);
    const payload = {
      id: normalizedId,
      name: scheduleName,
      prompt: typeof request.input.prompt === 'string' ? request.input.prompt : '',
      schedule: typeof request.input.schedule === 'string' ? request.input.schedule : 'manual',
      status: typeof request.input.status === 'string' ? request.input.status : 'ACTIVE',
      cwd: typeof request.input.cwd === 'string' ? request.input.cwd : '.',
      createdAt: new Date().toISOString(),
      source: 'sandbox-tool'
    } as const;
    await repository.createSchedule(payload);
    return {
      outputSummary: `Scheduled runtime task "${scheduleName}" as ${normalizedId}`,
      rawOutput: { schedule: payload }
    };
  }

  if (request.toolName === 'list_scheduled_tasks') {
    const items = await repository.listSchedules();
    return {
      outputSummary: `Loaded ${items.length} scheduled task${items.length === 1 ? '' : 's'}`,
      rawOutput: { items }
    };
  }

  if (request.toolName === 'cancel_scheduled_task') {
    const id = String(request.input.id ?? '').trim();
    if (!id) {
      throw new Error('cancel_scheduled_task requires an id.');
    }
    const schedule = await repository.readSchedule(id);
    const updated = {
      ...schedule,
      status: 'DISABLED',
      cancelledAt: new Date().toISOString()
    };
    await repository.updateSchedule(updated);
    return {
      outputSummary: `Cancelled scheduled task ${id}`,
      rawOutput: { schedule: updated }
    };
  }

  return undefined;
}

function toScheduleId(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug.length > 0 ? slug : `scheduled-task-${Date.now()}`;
}
