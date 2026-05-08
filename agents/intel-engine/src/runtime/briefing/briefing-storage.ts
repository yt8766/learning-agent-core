import type {
  BriefingFeedbackRecord,
  BriefingHistoryRecord,
  BriefingRawEvidenceRecord,
  DailyTechBriefingScheduleRecord,
  TechBriefingCategory,
  TechBriefingCategoryScheduleState,
  TechBriefingRunRecord
} from './briefing.types';
import {
  type BriefingStorageRepository,
  createFileBriefingStorageRepository,
  createMemoryBriefingStorageRepository,
  type PostgresReadyBriefingStorageRepository
} from './briefing-storage-repository';

export type { BriefingStorageRepository, PostgresReadyBriefingStorageRepository };
export { createFileBriefingStorageRepository, createMemoryBriefingStorageRepository };

export function createDefaultBriefingStorageRepository(workspaceRoot: string): BriefingStorageRepository {
  return createFileBriefingStorageRepository({ workspaceRoot });
}

export async function ensureDailyTechBriefingSchedules(
  workspaceRoot: string,
  categories: Partial<Record<TechBriefingCategory, { schedule: string }>>,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<DailyTechBriefingScheduleRecord[]> {
  return repository.ensureSchedules(categories);
}

export async function ensureDailyTechBriefingSchedule(
  workspaceRoot: string,
  category: TechBriefingCategory,
  schedule: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<DailyTechBriefingScheduleRecord> {
  return repository.ensureSchedule(category, schedule);
}

export async function readDailyTechBriefingSchedules(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<Partial<Record<TechBriefingCategory, DailyTechBriefingScheduleRecord>>> {
  return repository.readSchedules();
}

export async function saveDailyTechBriefingSchedule(
  workspaceRoot: string,
  schedule: DailyTechBriefingScheduleRecord,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.saveSchedule(schedule);
}

export async function readBriefingScheduleState(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>> {
  return repository.readScheduleState();
}

export async function saveBriefingScheduleState(
  workspaceRoot: string,
  state: Partial<Record<TechBriefingCategory, TechBriefingCategoryScheduleState>>,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.saveScheduleState(state);
}

export async function appendDailyTechBriefingRun(
  workspaceRoot: string,
  run: TechBriefingRunRecord,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.appendRun(run);
}

export async function readBriefingHistory(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<BriefingHistoryRecord[]> {
  return repository.readHistory();
}

export async function saveBriefingHistory(
  workspaceRoot: string,
  records: BriefingHistoryRecord[],
  now = new Date(),
  duplicateWindowDays = 7,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.saveHistory(records, now, duplicateWindowDays);
}

export async function readDailyTechBriefingRuns(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<TechBriefingRunRecord[]> {
  return repository.readRuns();
}

export async function listPersistedBriefingSchedules(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<DailyTechBriefingScheduleRecord[]> {
  return repository.listSchedules();
}

export async function appendBriefingFeedback(
  workspaceRoot: string,
  feedback: BriefingFeedbackRecord,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.appendFeedback(feedback);
}

export async function readBriefingFeedback(
  workspaceRoot: string,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<BriefingFeedbackRecord[]> {
  return repository.readFeedback();
}

export async function appendBriefingRawEvidence(
  workspaceRoot: string,
  category: TechBriefingCategory,
  capturedForDate: Date,
  evidence: BriefingRawEvidenceRecord[],
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<void> {
  await repository.appendRawEvidence(category, capturedForDate, evidence);
}

export async function readBriefingRawEvidence(
  workspaceRoot: string,
  category: TechBriefingCategory,
  capturedForDate: Date,
  repository = createDefaultBriefingStorageRepository(workspaceRoot)
): Promise<BriefingRawEvidenceRecord[]> {
  return repository.readRawEvidence(category, capturedForDate);
}
