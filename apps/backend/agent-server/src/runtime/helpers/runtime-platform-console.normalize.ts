import type { PlatformConsoleRecord, PlatformConsoleRuntimeRecord } from '../centers/runtime-platform-console.records';
import {
  PlatformConsoleEvalsRecordSchema,
  PlatformConsoleEvidenceRecordSchema,
  PlatformConsoleRuntimeRecordSchema,
  type PlatformConsoleEvalsRecord
} from '../centers/runtime-platform-console.schemas';

/**
 * Recovers enough runtime projection shape for Admin Console reads when persisted records are old or partial.
 * Use this only on read paths; write paths should still emit schema-valid records.
 */
export function normalizePlatformConsoleRuntimeRecord(value: unknown): PlatformConsoleRuntimeRecord {
  const parsed = PlatformConsoleRuntimeRecordSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const fallbackSource = isRecord(value) ? value : {};
  return {
    ...fallbackSource,
    usageAnalytics: isRecord(fallbackSource.usageAnalytics)
      ? {
          ...fallbackSource.usageAnalytics,
          daily: Array.isArray(fallbackSource.usageAnalytics.daily) ? fallbackSource.usageAnalytics.daily : [],
          persistedDailyHistory: Array.isArray(fallbackSource.usageAnalytics.persistedDailyHistory)
            ? fallbackSource.usageAnalytics.persistedDailyHistory
            : []
        }
      : {
          daily: [],
          persistedDailyHistory: []
        },
    recentRuns: Array.isArray(fallbackSource.recentRuns) ? fallbackSource.recentRuns : []
  };
}

export function normalizePlatformConsoleEvalsRecord(value: unknown): PlatformConsoleEvalsRecord {
  const parsed = PlatformConsoleEvalsRecordSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const fallbackSource = isRecord(value) ? value : {};
  const promptRegression = isRecord(fallbackSource.promptRegression) ? fallbackSource.promptRegression : undefined;
  return {
    ...fallbackSource,
    dailyTrend: [],
    persistedDailyHistory: [],
    recentRuns: [],
    promptRegression: promptRegression
      ? {
          ...promptRegression,
          suites: []
        }
      : undefined
  };
}

export function normalizePlatformConsoleEvidenceRecord(value: unknown): PlatformConsoleRecord['evidence'] {
  if (Array.isArray(value)) {
    return value;
  }

  const parsed = PlatformConsoleEvidenceRecordSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    totalEvidenceCount: 0,
    recentEvidence: []
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
