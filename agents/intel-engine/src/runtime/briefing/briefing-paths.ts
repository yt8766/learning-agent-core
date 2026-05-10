import { join } from 'node:path';

import { readJson } from 'fs-extra';

import type { TechBriefingCategory } from './briefing.types';

export const BRIEFING_CATEGORIES: TechBriefingCategory[] = [
  'frontend-security',
  'general-security',
  'devtool-security',
  'ai-tech',
  'frontend-tech',
  'backend-tech',
  'cloud-infra-tech'
];

export async function readJsonFileOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return (await readJson(filePath)) as T;
  } catch {
    // Briefing runtime files are append-only operational state. If a file is truncated or partially written,
    // fall back to an empty structure so scheduled runs can self-heal on the next successful write.
    return fallback;
  }
}

export function getStorageRoot(workspaceRoot: string) {
  return join(workspaceRoot, 'profile-storage', 'platform', 'intel-engine', 'briefing');
}

export function getSchedulePath(storageRoot: string, category: TechBriefingCategory) {
  return join(storageRoot, 'schedules', `daily-tech-briefing-${category}.json`);
}

export function getRunsPath(storageRoot: string) {
  return join(storageRoot, 'daily-tech-briefing-runs.json');
}

export function getHistoryPath(storageRoot: string) {
  return join(storageRoot, 'daily-tech-briefing-history.json');
}

export function getScheduleStatePath(storageRoot: string) {
  return join(storageRoot, 'daily-tech-briefing-schedule-state.json');
}

export function getFeedbackPath(storageRoot: string) {
  return join(storageRoot, 'daily-tech-briefing-feedback.json');
}

export function getRawEvidencePath(storageRoot: string, category: TechBriefingCategory, date: Date) {
  return join(storageRoot, 'raw', `${date.toISOString().slice(0, 10)}-${category}.json`);
}
