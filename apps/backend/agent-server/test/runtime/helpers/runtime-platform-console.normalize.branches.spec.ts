import { describe, expect, it } from 'vitest';

import {
  normalizePlatformConsoleRuntimeRecord,
  normalizePlatformConsoleEvalsRecord,
  normalizePlatformConsoleEvidenceRecord,
  isRecord
} from '../../../src/runtime/helpers/runtime-platform-console.normalize';

describe('normalizePlatformConsoleRuntimeRecord', () => {
  it('returns valid record unchanged', () => {
    const valid = {
      usageAnalytics: {
        daily: [{ day: '2026-04-01', tokens: 100, costUsd: 0.1, costCny: 0.7, runs: 1, overBudget: false }],
        persistedDailyHistory: [
          { day: '2026-04-01', tokens: 100, costUsd: 0.1, costCny: 0.7, runs: 1, overBudget: false }
        ]
      },
      recentRuns: []
    };
    const result = normalizePlatformConsoleRuntimeRecord(valid);
    expect(result.usageAnalytics.daily).toHaveLength(1);
    expect(result.usageAnalytics.persistedDailyHistory).toHaveLength(1);
  });

  it('falls back when value is not an object', () => {
    const result = normalizePlatformConsoleRuntimeRecord('invalid');
    expect(result.usageAnalytics.daily).toEqual([]);
    expect(result.recentRuns).toEqual([]);
  });

  it('falls back when value is null', () => {
    const result = normalizePlatformConsoleRuntimeRecord(null);
    expect(result.usageAnalytics.daily).toEqual([]);
    expect(result.recentRuns).toEqual([]);
  });

  it('falls back when value is undefined', () => {
    const result = normalizePlatformConsoleRuntimeRecord(undefined);
    expect(result.usageAnalytics.daily).toEqual([]);
    expect(result.recentRuns).toEqual([]);
  });

  it('handles object with missing usageAnalytics', () => {
    const result = normalizePlatformConsoleRuntimeRecord({ recentRuns: [{ id: 'r1' }] });
    // usageAnalytics may be filled from schema fallback or default
    expect(result.recentRuns).toHaveLength(1);
  });

  it('handles usageAnalytics with non-array daily', () => {
    const result = normalizePlatformConsoleRuntimeRecord({
      usageAnalytics: { daily: 'invalid' },
      recentRuns: []
    });
    expect(result.usageAnalytics.daily).toEqual([]);
  });

  it('handles usageAnalytics with non-array persistedDailyHistory', () => {
    const result = normalizePlatformConsoleRuntimeRecord({
      usageAnalytics: { daily: [], persistedDailyHistory: 'invalid' },
      recentRuns: []
    });
    expect(result.usageAnalytics.persistedDailyHistory).toEqual([]);
  });

  it('handles non-object usageAnalytics', () => {
    const result = normalizePlatformConsoleRuntimeRecord({
      usageAnalytics: 'not-an-object',
      recentRuns: []
    });
    expect(result.usageAnalytics.daily).toEqual([]);
    expect(result.usageAnalytics.persistedDailyHistory).toEqual([]);
  });

  it('handles non-array recentRuns', () => {
    const result = normalizePlatformConsoleRuntimeRecord({
      usageAnalytics: { daily: [], persistedDailyHistory: [] },
      recentRuns: 'not-array'
    });
    expect(result.recentRuns).toEqual([]);
  });

  it('handles number input', () => {
    const result = normalizePlatformConsoleRuntimeRecord(42);
    expect(result.usageAnalytics.daily).toEqual([]);
  });

  it('handles array input', () => {
    const result = normalizePlatformConsoleRuntimeRecord([1, 2, 3]);
    expect(result.usageAnalytics.daily).toEqual([]);
  });
});

describe('normalizePlatformConsoleEvalsRecord', () => {
  it('returns valid record unchanged', () => {
    const valid = {
      dailyTrend: [{ day: '2026-04-01', runCount: 1, passCount: 1, passRate: 100 }],
      persistedDailyHistory: [{ day: '2026-04-01', runCount: 1, passCount: 1, passRate: 100 }],
      recentRuns: [{ taskId: 't1', createdAt: '2026-04-01', success: true, scenarioIds: [] }],
      promptRegression: { suites: [{ suiteId: 's1', label: 'Test', promptCount: 1, versions: ['v1'] }] }
    };
    const result = normalizePlatformConsoleEvalsRecord(valid);
    expect(result.dailyTrend).toHaveLength(1);
    expect(result.recentRuns).toHaveLength(1);
    expect(result.promptRegression.suites).toHaveLength(1);
  });

  it('falls back when value is not an object', () => {
    const result = normalizePlatformConsoleEvalsRecord('invalid');
    expect(result.dailyTrend).toEqual([]);
    expect(result.persistedDailyHistory).toEqual([]);
    expect(result.recentRuns).toEqual([]);
  });

  it('falls back when value is null', () => {
    const result = normalizePlatformConsoleEvalsRecord(null);
    expect(result.dailyTrend).toEqual([]);
  });

  it('handles object with promptRegression as non-object', () => {
    const result = normalizePlatformConsoleEvalsRecord({
      dailyTrend: 'invalid',
      recentRuns: 'invalid',
      promptRegression: 'invalid'
    });
    expect(result.dailyTrend).toEqual([]);
    expect(result.recentRuns).toEqual([]);
    expect(result.promptRegression).toBeUndefined();
  });

  it('handles object with promptRegression as object', () => {
    const result = normalizePlatformConsoleEvalsRecord({
      promptRegression: { someField: 'value' }
    });
    expect(result.promptRegression).toBeDefined();
    expect(result.promptRegression.suites).toEqual([]);
  });

  it('handles missing promptRegression', () => {
    const result = normalizePlatformConsoleEvalsRecord({});
    expect(result.promptRegression).toBeUndefined();
  });

  it('handles number input', () => {
    const result = normalizePlatformConsoleEvalsRecord(0);
    expect(result.dailyTrend).toEqual([]);
  });
});

describe('normalizePlatformConsoleEvidenceRecord', () => {
  it('returns array input as-is', () => {
    const arr = [{ id: 'e1', type: 'test' }];
    const result = normalizePlatformConsoleEvidenceRecord(arr);
    expect(result).toEqual(arr);
  });

  it('returns valid object unchanged', () => {
    const valid = { totalEvidenceCount: 5, recentEvidence: [{ id: 'e1' }] };
    const result = normalizePlatformConsoleEvidenceRecord(valid);
    expect(result).toEqual(valid);
  });

  it('falls back when value is not array or valid object', () => {
    const result = normalizePlatformConsoleEvidenceRecord('invalid');
    expect(result).toEqual({ totalEvidenceCount: 0, recentEvidence: [] });
  });

  it('falls back when value is null', () => {
    const result = normalizePlatformConsoleEvidenceRecord(null);
    expect(result).toEqual({ totalEvidenceCount: 0, recentEvidence: [] });
  });

  it('falls back when value is undefined', () => {
    const result = normalizePlatformConsoleEvidenceRecord(undefined);
    expect(result).toEqual({ totalEvidenceCount: 0, recentEvidence: [] });
  });

  it('falls back when value is number', () => {
    const result = normalizePlatformConsoleEvidenceRecord(42);
    expect(result).toEqual({ totalEvidenceCount: 0, recentEvidence: [] });
  });

  it('returns empty array as-is', () => {
    const result = normalizePlatformConsoleEvidenceRecord([]);
    expect(result).toEqual([]);
  });
});

describe('isRecord', () => {
  it('returns true for objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isRecord(42)).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });

  it('returns true for arrays', () => {
    expect(isRecord([])).toBe(true);
  });
});
