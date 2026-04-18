import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

import type { ToolExecutionRequest } from '@agent/core';

import { toWorkspacePath } from '../sandbox/sandbox-executor-utils';

export async function executeSchedulingTool(request: ToolExecutionRequest) {
  if (request.toolName === 'schedule_task') {
    const scheduleName =
      typeof request.input.name === 'string' && request.input.name.trim().length > 0
        ? request.input.name.trim()
        : 'scheduled-task';
    const normalizedId = toScheduleId(scheduleName);
    const scheduleDir = toWorkspacePath('data/runtime/schedules');
    const schedulePath = toWorkspacePath(`data/runtime/schedules/${normalizedId}.json`);
    const payload = {
      id: normalizedId,
      name: scheduleName,
      prompt: typeof request.input.prompt === 'string' ? request.input.prompt : '',
      schedule: typeof request.input.schedule === 'string' ? request.input.schedule : 'manual',
      status: typeof request.input.status === 'string' ? request.input.status : 'ACTIVE',
      cwd: typeof request.input.cwd === 'string' ? request.input.cwd : '.',
      createdAt: new Date().toISOString(),
      source: 'sandbox-tool'
    };
    await mkdir(scheduleDir, { recursive: true });
    await writeFile(schedulePath, JSON.stringify(payload, null, 2));
    return {
      outputSummary: `Scheduled runtime task "${scheduleName}" as ${normalizedId}`,
      rawOutput: { path: schedulePath, schedule: payload }
    };
  }

  if (request.toolName === 'list_scheduled_tasks') {
    const scheduleDir = toWorkspacePath('data/runtime/schedules');
    const entries = await readdir(scheduleDir, { withFileTypes: true }).catch(() => []);
    const items = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const filePath = toWorkspacePath(`data/runtime/schedules/${entry.name}`);
      const schedule = JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
      items.push(schedule);
    }
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
    const schedulePath = toWorkspacePath(`data/runtime/schedules/${id}.json`);
    const schedule = JSON.parse(await readFile(schedulePath, 'utf8')) as Record<string, unknown>;
    const updated = {
      ...schedule,
      status: 'DISABLED',
      cancelledAt: new Date().toISOString()
    };
    await writeFile(schedulePath, JSON.stringify(updated, null, 2));
    return {
      outputSummary: `Cancelled scheduled task ${id}`,
      rawOutput: { path: relative(process.cwd(), schedulePath), schedule: updated }
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
