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

export function getSchedulePath(workspaceRoot: string, category: TechBriefingCategory) {
  return join(workspaceRoot, 'data', 'runtime', 'schedules', `daily-tech-briefing-${category}.json`);
}

export function getRunsPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-runs.json');
}

export function getHistoryPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-history.json');
}

export function getScheduleStatePath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-schedule-state.json');
}

export function getFeedbackPath(workspaceRoot: string) {
  return join(workspaceRoot, 'data', 'runtime', 'briefings', 'daily-tech-briefing-feedback.json');
}

export function getRawEvidencePath(workspaceRoot: string, category: TechBriefingCategory, date: Date) {
  return join(
    workspaceRoot,
    'data',
    'runtime',
    'briefings',
    'raw',
    `${date.toISOString().slice(0, 10)}-${category}.json`
  );
}
