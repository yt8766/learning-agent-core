import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { ActionIntent } from '@agent/core';
import { afterEach, describe, expect, it } from 'vitest';

import { executeSchedulingTool } from '../../src/executors/scheduling/scheduling-executor';
import { cleanupTempWorkspaces, createTempWorkspace } from '../test-utils/temp-workspace';

describe('executeSchedulingTool', () => {
  const originalCwd = process.cwd();
  const tempWorkspaces: string[] = [];

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempWorkspaces(tempWorkspaces.splice(0));
  });

  it('uses an injected repository for schedules without creating root data/runtime', async () => {
    const root = await createTempWorkspace('scheduling-tools');
    tempWorkspaces.push(root);
    process.chdir(root);
    const repository = createScheduleRepository();

    const scheduled = await executeSchedulingTool(
      {
        taskId: 'task-schedule',
        toolName: 'schedule_task',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          name: 'Daily Summary',
          prompt: 'Summarize yesterday',
          schedule: '0 9 * * *'
        }
      },
      {
        repository
      }
    );

    await executeSchedulingTool(
      {
        taskId: 'task-cancel',
        toolName: 'cancel_scheduled_task',
        intent: ActionIntent.WRITE_FILE,
        requestedBy: 'agent',
        input: {
          id: 'daily-summary'
        }
      },
      {
        repository
      }
    );

    const listed = await executeSchedulingTool(
      {
        taskId: 'task-list',
        toolName: 'list_scheduled_tasks',
        intent: ActionIntent.READ_FILE,
        requestedBy: 'agent',
        input: {}
      },
      {
        repository
      }
    );

    expect(scheduled?.rawOutput).toEqual(
      expect.objectContaining({
        schedule: expect.objectContaining({ id: 'daily-summary', source: 'sandbox-tool' })
      })
    );
    expect(listed?.rawOutput).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: 'daily-summary', status: 'DISABLED' })]
      })
    );
    await expect(stat(join(root, 'data', 'runtime'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

function createScheduleRepository() {
  const schedules = new Map<string, Record<string, unknown>>();
  return {
    async createSchedule(schedule: Record<string, unknown>) {
      schedules.set(String(schedule.id), schedule);
    },
    async listSchedules() {
      return [...schedules.values()];
    },
    async readSchedule(id: string) {
      const schedule = schedules.get(id);
      if (!schedule) {
        throw new Error(`Missing schedule ${id}`);
      }
      return schedule;
    },
    async updateSchedule(schedule: Record<string, unknown>) {
      schedules.set(String(schedule.id), schedule);
    }
  };
}
