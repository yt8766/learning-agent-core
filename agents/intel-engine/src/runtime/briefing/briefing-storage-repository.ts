import { join } from 'node:path';

import { ensureDir, pathExists, readdir, writeJson } from 'fs-extra';

import type {
  BriefingFeedbackRecord,
  BriefingHistoryRecord,
  BriefingRawEvidenceRecord,
  DailyTechBriefingScheduleRecord,
  TechBriefingCategory,
  TechBriefingCategoryScheduleState,
  TechBriefingRunRecord
} from './briefing.types';
import { computeNextRunAt, resolveRuntimeSchedule } from './briefing-schedule';
import {
  BRIEFING_CATEGORIES,
  getFeedbackPath,
  getHistoryPath,
  getRawEvidencePath,
  getRunsPath,
  getSchedulePath,
  getScheduleStatePath,
  getStorageRoot,
  readJsonFileOrDefault
} from './briefing-paths';

const MAX_BRIEFING_RUN_RECORDS = 200;
const BRIEFING_RUN_RETENTION_DAYS = 30;
const MAX_BRIEFING_HISTORY_RECORDS = 5000;

export interface BriefingStorageRepository {
  ensureSchedules(
    categories: Partial<Record<TechBriefingCategory, { schedule: string }>>
  ): Promise<DailyTechBriefingScheduleRecord[]>;
  ensureSchedule(category: TechBriefingCategory, schedule: string): Promise<DailyTechBriefingScheduleRecord>;
  readSchedules(): Promise<Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>>>;
  saveSchedule(schedule: DailyTechBriefingScheduleRecord): Promise<void>;
  listSchedules(): Promise<DailyTechBriefingScheduleRecord[]>;
  readScheduleState(): Promise<Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>>;
  saveScheduleState(state: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>): Promise<void>;
  appendRun(run: TechBriefingRunRecord): Promise<void>;
  readRuns(): Promise<TechBriefingRunRecord[]>;
  readHistory(): Promise<BriefingHistoryRecord[]>;
  saveHistory(records: BriefingHistoryRecord[], now?: Date, duplicateWindowDays?: number): Promise<void>;
  appendFeedback(feedback: BriefingFeedbackRecord): Promise<void>;
  readFeedback(): Promise<BriefingFeedbackRecord[]>;
  appendRawEvidence(
    category: TechBriefingCategory,
    capturedForDate: Date,
    evidence: BriefingRawEvidenceRecord[]
  ): Promise<void>;
  readRawEvidence(category: TechBriefingCategory, capturedForDate: Date): Promise<BriefingRawEvidenceRecord[]>;
}

export function createFileBriefingStorageRepository(options: {
  workspaceRoot: string;
  storageRoot?: string;
}): BriefingStorageRepository {
  const storageRoot = options.storageRoot ?? getStorageRoot(options.workspaceRoot);
  return {
    async ensureSchedules(categories) {
      const records: DailyTechBriefingScheduleRecord[] = [];
      for (const category of BRIEFING_CATEGORIES) {
        records.push(await this.ensureSchedule(category, categories[category]?.schedule ?? 'manual'));
      }
      return records;
    },
    async ensureSchedule(category, schedule) {
      const filePath = getSchedulePath(storageRoot, category);
      if (await pathExists(filePath)) {
        const existing = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
        if (existing) {
          return existing;
        }
      }
      const record = createDailyTechBriefingScheduleRecord(category, schedule, new Date());
      await ensureDir(join(storageRoot, 'schedules'));
      await writeJson(filePath, record, { spaces: 2 });
      return record;
    },
    async readSchedules() {
      const result: Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>> = {};
      for (const category of BRIEFING_CATEGORIES) {
        const filePath = getSchedulePath(storageRoot, category);
        if (await pathExists(filePath)) {
          const record = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
          if (record) {
            result[category] = record;
          }
        }
      }
      return result;
    },
    async saveSchedule(schedule) {
      await ensureDir(join(storageRoot, 'schedules'));
      await writeJson(getSchedulePath(storageRoot, schedule.category), schedule, { spaces: 2 });
    },
    async listSchedules() {
      const scheduleDir = join(storageRoot, 'schedules');
      const entries = await readdir(scheduleDir).catch(() => []);
      const records: DailyTechBriefingScheduleRecord[] = [];
      for (const entry of entries) {
        if (!entry.endsWith('.json') || !entry.startsWith('daily-tech-briefing-')) {
          continue;
        }
        const filePath = join(scheduleDir, entry);
        if (!(await pathExists(filePath))) {
          continue;
        }
        const record = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
        if (record) {
          records.push(record);
        }
      }
      return records;
    },
    async readScheduleState() {
      const filePath = getScheduleStatePath(storageRoot);
      if (!(await pathExists(filePath))) {
        return {};
      }
      return readJsonFileOrDefault(filePath, {});
    },
    async saveScheduleState(state) {
      await ensureDir(storageRoot);
      await writeJson(getScheduleStatePath(storageRoot), state, { spaces: 2 });
    },
    async appendRun(run) {
      const records = await this.readRuns();
      records.unshift(run);
      await ensureDir(storageRoot);
      await writeJson(getRunsPath(storageRoot), pruneRunRecords(records, new Date(run.runAt)), { spaces: 2 });
    },
    async readRuns() {
      const filePath = getRunsPath(storageRoot);
      if (!(await pathExists(filePath))) {
        return [];
      }
      return readJsonFileOrDefault(filePath, []);
    },
    async readHistory() {
      const filePath = getHistoryPath(storageRoot);
      if (!(await pathExists(filePath))) {
        return [];
      }
      return readJsonFileOrDefault(filePath, []);
    },
    async saveHistory(records, now = new Date(), duplicateWindowDays = 7) {
      await ensureDir(storageRoot);
      await writeJson(getHistoryPath(storageRoot), pruneHistoryRecordsByWindow(records, now, duplicateWindowDays), {
        spaces: 2
      });
    },
    async appendFeedback(feedback) {
      const records = await this.readFeedback();
      records.unshift(feedback);
      await ensureDir(storageRoot);
      await writeJson(getFeedbackPath(storageRoot), records.slice(0, 500), { spaces: 2 });
    },
    async readFeedback() {
      const filePath = getFeedbackPath(storageRoot);
      if (!(await pathExists(filePath))) {
        return [];
      }
      return readJsonFileOrDefault(filePath, []);
    },
    async appendRawEvidence(category, capturedForDate, evidence) {
      if (evidence.length === 0) {
        return;
      }
      const records = await this.readRawEvidence(category, capturedForDate);
      await ensureDir(join(storageRoot, 'raw'));
      await writeJson(getRawEvidencePath(storageRoot, category, capturedForDate), records.concat(evidence), {
        spaces: 2
      });
    },
    async readRawEvidence(category, capturedForDate) {
      const filePath = getRawEvidencePath(storageRoot, category, capturedForDate);
      if (!(await pathExists(filePath))) {
        return [];
      }
      return readJsonFileOrDefault(filePath, []);
    }
  };
}

export function createMemoryBriefingStorageRepository(): BriefingStorageRepository {
  const schedules: Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>> = {};
  let scheduleState: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>> = {};
  let runs: TechBriefingRunRecord[] = [];
  let history: BriefingHistoryRecord[] = [];
  let feedback: BriefingFeedbackRecord[] = [];
  const rawEvidence = new Map<string, BriefingRawEvidenceRecord[]>();

  return {
    async ensureSchedules(categories) {
      const records: DailyTechBriefingScheduleRecord[] = [];
      for (const category of BRIEFING_CATEGORIES) {
        records.push(await this.ensureSchedule(category, categories[category]?.schedule ?? 'manual'));
      }
      return records;
    },
    async ensureSchedule(category, schedule) {
      schedules[category] ??= createDailyTechBriefingScheduleRecord(category, schedule, new Date());
      return schedules[category];
    },
    async readSchedules() {
      return { ...schedules };
    },
    async saveSchedule(schedule) {
      schedules[schedule.category] = schedule;
    },
    async listSchedules() {
      return Object.values(schedules);
    },
    async readScheduleState() {
      return { ...scheduleState };
    },
    async saveScheduleState(state) {
      scheduleState = { ...state };
    },
    async appendRun(run) {
      runs = pruneRunRecords([run, ...runs], new Date(run.runAt));
    },
    async readRuns() {
      return [...runs];
    },
    async readHistory() {
      return [...history];
    },
    async saveHistory(records, now = new Date(), duplicateWindowDays = 7) {
      history = pruneHistoryRecordsByWindow(records, now, duplicateWindowDays);
    },
    async appendFeedback(record) {
      feedback = [record, ...feedback].slice(0, 500);
    },
    async readFeedback() {
      return [...feedback];
    },
    async appendRawEvidence(category, capturedForDate, evidence) {
      if (evidence.length === 0) {
        return;
      }
      const key = rawEvidenceKey(category, capturedForDate);
      rawEvidence.set(key, [...(rawEvidence.get(key) ?? []), ...evidence]);
    },
    async readRawEvidence(category, capturedForDate) {
      return [...(rawEvidence.get(rawEvidenceKey(category, capturedForDate)) ?? [])];
    }
  };
}

export type PostgresReadyBriefingStorageRepository = BriefingStorageRepository;

function pruneRunRecords(records: TechBriefingRunRecord[], now = new Date()) {
  const cutoff = now.getTime() - BRIEFING_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter(record => new Date(record.runAt).getTime() >= cutoff)
    .sort((left, right) => new Date(right.runAt).getTime() - new Date(left.runAt).getTime())
    .slice(0, MAX_BRIEFING_RUN_RECORDS);
}

function pruneHistoryRecordsByWindow(records: BriefingHistoryRecord[], now: Date, duplicateWindowDays: number) {
  const cutoff = now.getTime() - duplicateWindowDays * 24 * 60 * 60 * 1000;
  const pruned = records.filter(record => {
    const sentAt = record.lastSentAt ? new Date(record.lastSentAt).getTime() : NaN;
    const seenAt = new Date(record.firstSeenAt).getTime();
    if (Number.isFinite(sentAt)) {
      return sentAt >= cutoff;
    }
    return seenAt >= cutoff;
  });
  return pruneHistoryRecords(pruned);
}

function pruneHistoryRecords(records: BriefingHistoryRecord[]) {
  return records
    .sort((left, right) => {
      const rightTime = new Date(right.lastSentAt ?? right.firstSeenAt).getTime();
      const leftTime = new Date(left.lastSentAt ?? left.firstSeenAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, MAX_BRIEFING_HISTORY_RECORDS);
}

function createDailyTechBriefingScheduleRecord(
  category: TechBriefingCategory,
  schedule: string,
  now: Date
): DailyTechBriefingScheduleRecord {
  const resolution = resolveRuntimeSchedule(schedule);
  const nowIso = now.toISOString();
  return {
    id: `daily-tech-briefing-${category}`,
    name: `Daily Tech Briefing - ${category}`,
    kind: 'daily-tech-briefing',
    category,
    schedule,
    cron: resolution.mode === 'cron' ? resolution.cron : undefined,
    scheduleValid: resolution.scheduleValid,
    scheduler: 'bree',
    status: 'ACTIVE',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    source: 'runtime-bootstrap',
    createdAt: nowIso,
    updatedAt: nowIso,
    nextRunAt: resolution.mode === 'manual' ? undefined : computeNextRunAt(schedule, now).toISOString()
  };
}

function rawEvidenceKey(category: TechBriefingCategory, date: Date) {
  return `${date.toISOString().slice(0, 10)}:${category}`;
}
