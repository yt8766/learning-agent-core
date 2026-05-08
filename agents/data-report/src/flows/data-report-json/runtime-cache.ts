import { ensureDir, pathExists, readJson, writeJson } from 'fs-extra';
import { dirname, join } from 'node:path';

import type { DataReportJsonGenerateResult, DataReportJsonGraphState } from '../../types/data-report-json';

export const DATA_REPORT_JSON_ARTIFACT_CACHE_PATH = join(
  process.cwd(),
  'artifacts',
  'runtime',
  'data-report-json-artifacts.json'
);
const DATA_REPORT_JSON_ARTIFACT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED = !process.env.VITEST;
export const DATA_REPORT_JSON_ARTIFACT_CACHE_TTL = DATA_REPORT_JSON_ARTIFACT_CACHE_TTL_MS;

export interface DataReportJsonArtifactCacheEntry {
  createdAt: string;
  updatedAt: string;
  ttlMs?: number;
  result: DataReportJsonGenerateResult;
}

const artifactCacheMemory = new Map<string, DataReportJsonArtifactCacheEntry>();

export async function readArtifactCache() {
  if (!DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED) {
    return artifactCacheMemory;
  }

  if (!artifactCacheMemory.size && (await pathExists(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH))) {
    const payload = (await readJson(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH)) as Record<
      string,
      DataReportJsonGenerateResult | DataReportJsonArtifactCacheEntry
    >;
    Object.entries(payload ?? {}).forEach(([key, value]) => {
      if (value && 'result' in value) {
        artifactCacheMemory.set(key, value);
        return;
      }

      artifactCacheMemory.set(key, {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ttlMs: DATA_REPORT_JSON_ARTIFACT_CACHE_TTL_MS,
        result: value as DataReportJsonGenerateResult
      });
    });
  }

  return artifactCacheMemory;
}

export async function writeArtifactCache() {
  if (!DATA_REPORT_JSON_ARTIFACT_CACHE_ENABLED) {
    return;
  }

  await ensureDir(dirname(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH));
  await writeJson(DATA_REPORT_JSON_ARTIFACT_CACHE_PATH, Object.fromEntries(artifactCacheMemory.entries()), {
    spaces: 2
  });
}

export function buildArtifactCacheKey(state: DataReportJsonGraphState) {
  if (!state.artifactCacheKey) {
    return undefined;
  }

  return JSON.stringify({
    key: state.artifactCacheKey,
    goal: state.goal,
    currentSchema: state.currentSchema,
    reportSchemaInput: state.reportSchemaInput
  });
}

export function isArtifactCacheExpired(entry: DataReportJsonArtifactCacheEntry) {
  if (!entry.ttlMs) {
    return false;
  }

  return Date.now() - new Date(entry.updatedAt).getTime() > entry.ttlMs;
}
