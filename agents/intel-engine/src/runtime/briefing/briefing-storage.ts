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
  readJsonFileOrDefault
} from './briefing-paths';

const MAX_BRIEFING_RUN_RECORDS = 200;
const BRIEFING_RUN_RETENTION_DAYS = 30;
const MAX_BRIEFING_HISTORY_RECORDS = 5000;

export async function ensureDailyTechBriefingSchedules(
  workspaceRoot: string,
  categories: Partial<Record<TechBriefingCategory, { schedule: string }>>
): Promise<DailyTechBriefingScheduleRecord[]> {
  const records: DailyTechBriefingScheduleRecord[] = [];
  for (const category of BRIEFING_CATEGORIES) {
    records.push(
      await ensureDailyTechBriefingSchedule(workspaceRoot, category, categories[category]?.schedule ?? 'manual')
    );
  }
  return records;
}

export async function ensureDailyTechBriefingSchedule(
  workspaceRoot: string,
  category: TechBriefingCategory,
  schedule: string
): Promise<DailyTechBriefingScheduleRecord> {
  const filePath = getSchedulePath(workspaceRoot, category);
  if (await pathExists(filePath)) {
    const existing = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
    if (existing) {
      return existing;
    }
  }
  const record = createDailyTechBriefingScheduleRecord(category, schedule, new Date());
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'schedules'));
  await writeJson(filePath, record, { spaces: 2 });
  return record;
}

export async function readDailyTechBriefingSchedules(
  workspaceRoot: string
): Promise<Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>>> {
  const result: Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>> = {};
  for (const category of BRIEFING_CATEGORIES) {
    const filePath = getSchedulePath(workspaceRoot, category);
    if (await pathExists(filePath)) {
      const record = await readJsonFileOrDefault<DailyTechBriefingScheduleRecord | null>(filePath, null);
      if (record) {
        result[category] = record;
      }
    }
  }
  return result;
}

export async function saveDailyTechBriefingSchedule(
  workspaceRoot: string,
  schedule: DailyTechBriefingScheduleRecord
): Promise<void> {
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'schedules'));
  await writeJson(getSchedulePath(workspaceRoot, schedule.category), schedule, { spaces: 2 });
}

export async function readBriefingScheduleState(
  workspaceRoot: string
): Promise<Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>> {
  const filePath = getScheduleStatePath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return {};
  }
  return readJsonFileOrDefault(filePath, {});
}

export async function saveBriefingScheduleState(
  workspaceRoot: string,
  state: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>
): Promise<void> {
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getScheduleStatePath(workspaceRoot), state, { spaces: 2 });
}

export async function appendDailyTechBriefingRun(workspaceRoot: string, run: TechBriefingRunRecord): Promise<void> {
  const records = await readDailyTechBriefingRuns(workspaceRoot);
  records.unshift(run);
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getRunsPath(workspaceRoot), pruneRunRecords(records, new Date(run.runAt)), { spaces: 2 });
}

export async function readBriefingHistory(workspaceRoot: string): Promise<BriefingHistoryRecord[]> {
  const filePath = getHistoryPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

export async function saveBriefingHistory(
  workspaceRoot: string,
  records: BriefingHistoryRecord[],
  now = new Date(),
  duplicateWindowDays = 7
): Promise<void> {
  const cutoff = now.getTime() - duplicateWindowDays * 24 * 60 * 60 * 1000;
  const pruned = records.filter(record => {
    const sentAt = record.lastSentAt ? new Date(record.lastSentAt).getTime() : NaN;
    const seenAt = new Date(record.firstSeenAt).getTime();
    if (Number.isFinite(sentAt)) {
      return sentAt >= cutoff;
    }
    return seenAt >= cutoff;
  });
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getHistoryPath(workspaceRoot), pruneHistoryRecords(pruned), { spaces: 2 });
}

export async function readDailyTechBriefingRuns(workspaceRoot: string): Promise<TechBriefingRunRecord[]> {
  const filePath = getRunsPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

export async function listPersistedBriefingSchedules(
  workspaceRoot: string
): Promise<DailyTechBriefingScheduleRecord[]> {
  const scheduleDir = join(workspaceRoot, 'data', 'runtime', 'schedules');
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
}

export async function appendBriefingFeedback(workspaceRoot: string, feedback: BriefingFeedbackRecord): Promise<void> {
  const records = await readBriefingFeedback(workspaceRoot);
  records.unshift(feedback);
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings'));
  await writeJson(getFeedbackPath(workspaceRoot), records.slice(0, 500), { spaces: 2 });
}

export async function readBriefingFeedback(workspaceRoot: string): Promise<BriefingFeedbackRecord[]> {
  const filePath = getFeedbackPath(workspaceRoot);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

export async function appendBriefingRawEvidence(
  workspaceRoot: string,
  category: TechBriefingCategory,
  capturedForDate: Date,
  evidence: BriefingRawEvidenceRecord[]
): Promise<void> {
  if (evidence.length === 0) {
    return;
  }
  const records = await readBriefingRawEvidence(workspaceRoot, category, capturedForDate);
  await ensureDir(join(workspaceRoot, 'data', 'runtime', 'briefings', 'raw'));
  await writeJson(getRawEvidencePath(workspaceRoot, category, capturedForDate), records.concat(evidence), {
    spaces: 2
  });
}

export async function readBriefingRawEvidence(
  workspaceRoot: string,
  category: TechBriefingCategory,
  capturedForDate: Date
): Promise<BriefingRawEvidenceRecord[]> {
  const filePath = getRawEvidencePath(workspaceRoot, category, capturedForDate);
  if (!(await pathExists(filePath))) {
    return [];
  }
  return readJsonFileOrDefault(filePath, []);
}

function pruneRunRecords(records: TechBriefingRunRecord[], now = new Date()) {
  const cutoff = now.getTime() - BRIEFING_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter(record => new Date(record.runAt).getTime() >= cutoff)
    .sort((left, right) => new Date(right.runAt).getTime() - new Date(left.runAt).getTime())
    .slice(0, MAX_BRIEFING_RUN_RECORDS);
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
