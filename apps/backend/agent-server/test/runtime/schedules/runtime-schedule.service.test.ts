import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ensureDir, readJson, writeJson } from 'fs-extra';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ensureDailyTechBriefingSchedules } from '../../../src/runtime/briefings/runtime-tech-briefing-storage';
import { resolveRuntimeSchedule } from '../../../src/runtime/schedules/runtime-schedule.helpers';
import { RuntimeScheduleService } from '../../../src/runtime/schedules/runtime-schedule.service';

describe('RuntimeScheduleService', () => {
  let workspaceRoot = '';

  afterEach(async () => {
    if (workspaceRoot) {
      await rm(workspaceRoot, { recursive: true, force: true });
      workspaceRoot = '';
    }
  });

  it('支持 daily / weekday / manual schedule 映射', () => {
    expect(resolveRuntimeSchedule('daily 11:00')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '0 11 * * *' })
    );
    expect(resolveRuntimeSchedule('weekday 11:00')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '0 11 * * 1-5' })
    );
    expect(resolveRuntimeSchedule('daily every 10 minutes')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '*/10 * * * *' })
    );
    expect(resolveRuntimeSchedule('weekday every 4 hours')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '0 */4 * * 1-5' })
    );
    expect(resolveRuntimeSchedule('manual')).toEqual(expect.objectContaining({ mode: 'manual', scheduleValid: true }));
    expect(resolveRuntimeSchedule('daily nope')).toEqual(
      expect.objectContaining({ mode: 'invalid', scheduleValid: false })
    );
  });

  it('会按分类注册 Bree job 并回写 metadata', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-schedule-'));
    await ensureDir(join(workspaceRoot, 'apps', 'backend', 'agent-server', 'workers'));
    await writeFile(
      join(workspaceRoot, 'apps', 'backend', 'agent-server', 'workers', 'runtime-schedule-worker.js'),
      "require('node:worker_threads').parentPort?.postMessage('done');\n"
    );
    await ensureDailyTechBriefingSchedules(workspaceRoot, {
      'frontend-security': { schedule: 'daily every 4 hours' },
      'general-security': { schedule: 'daily every 4 hours' },
      'devtool-security': { schedule: 'daily every 4 hours' },
      'ai-tech': { schedule: 'daily 11:00' },
      'frontend-tech': { schedule: 'daily 11:00' },
      'backend-tech': { schedule: 'daily 11:00' },
      'cloud-infra-tech': { schedule: 'daily 11:00' }
    });

    const service = new RuntimeScheduleService(() => ({
      settings: {
        workspaceRoot,
        dailyTechBriefing: {
          enabled: true,
          schedule: 'daily 11:00',
          categories: {
            frontendSecurity: { baseIntervalHours: 4 },
            generalSecurity: { baseIntervalHours: 4 },
            devtoolSecurity: { baseIntervalHours: 4 },
            aiTech: { baseIntervalHours: 24 },
            frontendTech: { baseIntervalHours: 24 },
            backendTech: { baseIntervalHours: 24 },
            cloudInfraTech: { baseIntervalHours: 24 }
          },
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 14
        }
      },
      techBriefingService: { runScheduled: vi.fn(async () => null) } as never
    }));

    await service.initialize();
    const schedule = await readJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-frontend-security.json')
    );

    expect(schedule.cron).toBe('0 */4 * * *');
    expect(schedule.scheduleValid).toBe(true);
    expect(schedule.scheduler).toBe('bree');
    expect(schedule.jobKey).toBe('runtime-tech-briefing:frontend-security');
    expect(schedule.lastRegisteredAt).toBeTruthy();
    const aiSchedule = await readJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-ai-tech.json')
    );
    expect(aiSchedule.schedule).toBe('daily 11:00');
    expect(aiSchedule.cron).toBe('0 11 * * *');

    await service.dispose();
  });

  it('manual 与非法 schedule 不会注册 Bree job', async () => {
    workspaceRoot = await mkdtemp(join(tmpdir(), 'runtime-schedule-manual-'));
    await ensureDir(join(workspaceRoot, 'apps', 'backend', 'agent-server', 'workers'));
    await writeFile(
      join(workspaceRoot, 'apps', 'backend', 'agent-server', 'workers', 'runtime-schedule-worker.js'),
      "require('node:worker_threads').parentPort?.postMessage('done');\n"
    );
    await ensureDir(join(workspaceRoot, 'data', 'runtime', 'schedules'));
    await writeJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-frontend-security.json'),
      {
        id: 'daily-tech-briefing-frontend-security',
        name: 'Daily Tech Briefing',
        kind: 'daily-tech-briefing',
        category: 'frontend-security',
        schedule: 'manual',
        status: 'ACTIVE',
        source: 'runtime-bootstrap',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
      },
      { spaces: 2 }
    );

    const service = new RuntimeScheduleService(() => ({
      settings: {
        workspaceRoot,
        dailyTechBriefing: {
          enabled: true,
          schedule: 'manual',
          categories: {
            frontendSecurity: { baseIntervalHours: 4 },
            generalSecurity: { baseIntervalHours: 4 },
            devtoolSecurity: { baseIntervalHours: 4 },
            aiTech: { baseIntervalHours: 24 },
            frontendTech: { baseIntervalHours: 24 },
            backendTech: { baseIntervalHours: 24 },
            cloudInfraTech: { baseIntervalHours: 24 }
          },
          sendEmptyDigest: true,
          maxItemsPerCategory: 2,
          sourcePolicy: 'tiered-authority',
          webhookEnvVar: 'LARK_BOT_WEBHOOK_URL',
          aiLookbackDays: 7,
          frontendLookbackDays: 7,
          securityLookbackDays: 14
        }
      },
      techBriefingService: { runScheduled: vi.fn(async () => null) } as never
    }));

    await service.initialize();
    const manualSchedule = await readJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-frontend-security.json')
    );
    expect(manualSchedule.scheduleValid).toBe(true);
    expect(manualSchedule.jobKey).toBeUndefined();
    expect(manualSchedule.nextRunAt).toBeUndefined();

    await writeJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-frontend-security.json'),
      {
        ...manualSchedule,
        schedule: 'daily nope'
      },
      { spaces: 2 }
    );

    await service.syncSchedules(new Date('2026-04-01T00:00:00.000Z'));
    const invalidSchedule = await readJson(
      join(workspaceRoot, 'data', 'runtime', 'schedules', 'daily-tech-briefing-frontend-security.json')
    );
    expect(invalidSchedule.scheduleValid).toBe(false);
    expect(invalidSchedule.jobKey).toBeUndefined();

    await service.dispose();
  });
});
