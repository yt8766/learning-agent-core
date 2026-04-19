import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Bree publishes a CommonJS constructor export; require-style import keeps Nest CJS runtime compatible.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import Bree = require('bree');

import type { RuntimeTechBriefingService } from '../briefings/runtime-tech-briefing.service';
import { computeNextRunAt, resolveRuntimeSchedule } from './runtime-schedule.helpers';
import {
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  saveDailyTechBriefingSchedule
} from '../briefings/runtime-tech-briefing-storage';
import type { DailyTechBriefingScheduleRecord, TechBriefingCategory } from '../briefings/runtime-tech-briefing.types';

const SCHEDULE_REFRESH_MS = 30_000;
const METRICS_SNAPSHOT_REFRESH_MS = 30 * 60 * 1000;
const BRIEFING_CATEGORIES: TechBriefingCategory[] = [
  'frontend-security',
  'general-security',
  'devtool-security',
  'ai-tech',
  'frontend-tech',
  'backend-tech',
  'cloud-infra-tech'
];

export interface RuntimeScheduleContext {
  settings: {
    workspaceRoot: string;
    dailyTechBriefing: {
      enabled: boolean;
      schedule: string;
      categories?: {
        frontendSecurity?: { baseIntervalHours: number };
        generalSecurity?: { baseIntervalHours: number };
        devtoolSecurity?: { baseIntervalHours: number };
        aiTech?: { baseIntervalHours: number };
        frontendTech?: { baseIntervalHours: number };
        backendTech?: { baseIntervalHours: number };
        cloudInfraTech?: { baseIntervalHours: number };
      };
    };
  };
  techBriefingService: RuntimeTechBriefingService;
  refreshMetricsSnapshots?: (days: number) => Promise<unknown>;
}

export class RuntimeScheduleService {
  private bree?: Bree;
  private initialized = false;
  private refreshTimer?: NodeJS.Timeout;
  private metricsRefreshTimer?: NodeJS.Timeout;

  constructor(private readonly getContext: () => RuntimeScheduleContext) {}

  async initialize() {
    if (this.initialized) {
      return;
    }
    this.startMetricsRefreshLoop();

    if (this.ctx().settings.dailyTechBriefing.enabled) {
      this.bree = new Bree({
        root: false,
        jobs: [],
        logger: false
      });
      await ensureDailyTechBriefingSchedules(this.ctx().settings.workspaceRoot, buildCategorySchedules(this.ctx()));
      await this.syncSchedules();

      this.refreshTimer = setInterval(() => {
        void this.syncSchedules();
      }, SCHEDULE_REFRESH_MS);
      this.refreshTimer.unref?.();
    }
    this.initialized = true;
  }

  async dispose() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
    if (this.metricsRefreshTimer) {
      clearInterval(this.metricsRefreshTimer);
      this.metricsRefreshTimer = undefined;
    }
    if (this.bree) {
      await this.bree.stop().catch(() => undefined);
    }
    this.initialized = false;
  }

  async syncSchedules(now = new Date()) {
    const schedules = await listPersistedBriefingSchedules(this.ctx().settings.workspaceRoot);
    for (const schedule of schedules) {
      await this.syncScheduleRecord(schedule, now);
    }
  }

  async syncMetricsSnapshots(days = 30) {
    if (!this.ctx().refreshMetricsSnapshots) {
      return;
    }
    await this.ctx().refreshMetricsSnapshots(days);
  }

  private async syncScheduleRecord(schedule: DailyTechBriefingScheduleRecord, now: Date) {
    const resolution = resolveRuntimeSchedule(schedule.schedule);
    const isActive = String(schedule.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
    const shouldRegister = isActive && resolution.mode === 'cron';
    const jobKey = `runtime-tech-briefing:${schedule.category}`;
    const nextSchedule: DailyTechBriefingScheduleRecord = {
      ...schedule,
      scheduler: 'bree',
      scheduleValid: resolution.scheduleValid,
      cron: resolution.cron,
      jobKey: shouldRegister ? jobKey : undefined,
      lastRegisteredAt: shouldRegister ? now.toISOString() : schedule.lastRegisteredAt,
      nextRunAt: shouldRegister ? computeNextRunAt(schedule.schedule, now).toISOString() : undefined,
      updatedAt: now.toISOString()
    };

    if (shouldRegister) {
      await this.registerBriefingJob(schedule.category, schedule.schedule, resolution.cron!);
    } else {
      await this.removeJob(jobKey);
    }

    if (JSON.stringify(schedule) !== JSON.stringify(nextSchedule)) {
      await saveDailyTechBriefingSchedule(this.ctx().settings.workspaceRoot, nextSchedule);
    }
  }

  private async registerBriefingJob(category: TechBriefingCategory, rawSchedule: string, cron: string) {
    const bree = this.ensureBree();
    const name = `runtime-tech-briefing:${category}`;
    const existing = bree.config.jobs.find(job => job.name === name);
    if (existing?.cron === cron) {
      return;
    }
    if (existing) {
      await this.removeJob(name);
    }

    await bree.add({
      name,
      path: resolveScheduleWorkerPath(this.ctx().settings.workspaceRoot),
      cron,
      timeout: false,
      worker: {
        workerData: {
          jobId: name,
          category,
          workspaceRoot: this.ctx().settings.workspaceRoot,
          dailyTechBriefing: {
            ...this.ctx().settings.dailyTechBriefing,
            schedule: rawSchedule
          }
        }
      }
    });
    await bree.start(name);
  }

  private async removeJob(name: string) {
    const bree = this.ensureBree();
    const existing = bree.config.jobs.find(job => job.name === name);
    if (!existing) {
      return;
    }
    await bree.remove(name).catch(() => undefined);
  }

  private ensureBree() {
    if (!this.bree) {
      throw new Error('RuntimeScheduleService has not been initialized.');
    }
    return this.bree;
  }

  private startMetricsRefreshLoop() {
    if (!this.ctx().refreshMetricsSnapshots || this.metricsRefreshTimer) {
      return;
    }
    this.metricsRefreshTimer = setInterval(() => {
      void this.syncMetricsSnapshots().catch(() => undefined);
    }, METRICS_SNAPSHOT_REFRESH_MS);
    this.metricsRefreshTimer.unref?.();
  }

  private ctx() {
    return this.getContext();
  }
}

function buildCategorySchedules(ctx: RuntimeScheduleContext) {
  return {
    'frontend-security': {
      schedule: `daily every ${ctx.settings.dailyTechBriefing.categories?.frontendSecurity?.baseIntervalHours ?? 4} hours`
    },
    'general-security': {
      schedule: `daily every ${ctx.settings.dailyTechBriefing.categories?.generalSecurity?.baseIntervalHours ?? 4} hours`
    },
    'devtool-security': {
      schedule: `daily every ${ctx.settings.dailyTechBriefing.categories?.devtoolSecurity?.baseIntervalHours ?? 4} hours`
    },
    'ai-tech': { schedule: ctx.settings.dailyTechBriefing.schedule || 'daily 11:00' },
    'frontend-tech': { schedule: ctx.settings.dailyTechBriefing.schedule || 'daily 11:00' },
    'backend-tech': { schedule: ctx.settings.dailyTechBriefing.schedule || 'daily 11:00' },
    'cloud-infra-tech': { schedule: ctx.settings.dailyTechBriefing.schedule || 'daily 11:00' }
  } satisfies Partial<Record<TechBriefingCategory, { schedule: string }>>;
}

function resolveScheduleWorkerPath(workspaceRoot: string) {
  const candidates = [
    join(workspaceRoot, 'apps/backend/agent-server/workers/runtime-schedule-worker.mjs'),
    join(workspaceRoot, 'apps/backend/agent-server/workers/runtime-schedule-worker.js'),
    resolve(__dirname, '../../../workers/runtime-schedule-worker.mjs'),
    resolve(__dirname, '../../../workers/runtime-schedule-worker.js')
  ];

  return candidates.find(candidate => existsSync(candidate)) ?? candidates[0]!;
}
