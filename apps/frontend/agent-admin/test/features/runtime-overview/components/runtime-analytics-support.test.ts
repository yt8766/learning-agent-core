import { describe, expect, it } from 'vitest';

import {
  buildCapacityData,
  buildModelDistributionData,
  buildProviderBillingTrendData,
  buildUsageTrendData,
  formatDayLabel
} from '@/features/runtime-overview/components/runtime-analytics-support';

describe('runtime-analytics-support', () => {
  it('formats day labels and preserves invalid values', () => {
    expect(formatDayLabel('2026-03-30')).toBe('3/30');
    expect(formatDayLabel('not-a-date')).toBe('not-a-date');
  });

  it('builds usage, billing, model, and capacity datasets', () => {
    expect(buildUsageTrendData([{ day: '2026-03-30', tokens: 1200, costCny: 6.5, runs: 3 }])).toEqual([
      {
        day: '2026-03-30',
        dayLabel: '3/30',
        tokens: 1200,
        costCny: 6.5,
        runs: 3
      }
    ]);

    expect(buildProviderBillingTrendData([{ day: '2026-03-29', totalTokens: 3000, costCny: 18, runs: 4 }])).toEqual([
      {
        day: '2026-03-29',
        dayLabel: '3/29',
        totalTokens: 3000,
        costCny: 18,
        runs: 4
      }
    ]);

    expect(buildModelDistributionData([{ model: 'gpt-5.4', tokens: 5000, costCny: 21, runCount: 7 }])).toEqual([
      {
        model: 'gpt-5.4',
        tokens: 5000,
        costCny: 21,
        runCount: 7
      }
    ]);

    expect(
      buildCapacityData({
        activeWorkerSlotCount: 2,
        availableWorkerSlotCount: 5,
        queueDepth: 1,
        blockedRunCount: 0
      })
    ).toEqual([
      expect.objectContaining({ name: 'activeSlots', value: 2 }),
      expect.objectContaining({ name: 'availableSlots', value: 5 }),
      expect.objectContaining({ name: 'queueDepth', value: 1 }),
      expect.objectContaining({ name: 'blockedRuns', value: 0 })
    ]);
  });
});
