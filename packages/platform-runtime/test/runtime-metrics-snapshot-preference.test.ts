import { describe, expect, it } from 'vitest';

import {
  shouldUsePersistedEvalSnapshot,
  shouldUsePersistedUsageSnapshot
} from '../src/centers/runtime-metrics-snapshot-preference';

describe('runtime metrics snapshot preference', () => {
  it('uses persisted usage snapshots when daily history or recent audit exists, or when there are no tasks', () => {
    expect(
      shouldUsePersistedUsageSnapshot(
        {
          persistedDailyHistory: [{ day: '2026-04-19' }],
          recentUsageAudit: []
        } as any,
        [{ id: 'task-1' }] as any
      )
    ).toBe(true);

    expect(
      shouldUsePersistedUsageSnapshot(
        {
          persistedDailyHistory: [],
          recentUsageAudit: [{ taskId: 'task-1' }]
        } as any,
        [{ id: 'task-1' }] as any
      )
    ).toBe(true);

    expect(
      shouldUsePersistedUsageSnapshot(
        {
          persistedDailyHistory: [],
          recentUsageAudit: []
        } as any,
        [] as any
      )
    ).toBe(true);

    expect(
      shouldUsePersistedUsageSnapshot(
        {
          persistedDailyHistory: [],
          recentUsageAudit: []
        } as any,
        [{ id: 'task-1' }] as any
      )
    ).toBe(false);
  });

  it('uses persisted eval snapshots when daily history exists or when there are no tasks', () => {
    expect(
      shouldUsePersistedEvalSnapshot(
        {
          persistedDailyHistory: [{ day: '2026-04-19' }]
        } as any,
        [{ id: 'task-1' }] as any
      )
    ).toBe(true);

    expect(
      shouldUsePersistedEvalSnapshot(
        {
          persistedDailyHistory: []
        } as any,
        [] as any
      )
    ).toBe(true);

    expect(
      shouldUsePersistedEvalSnapshot(
        {
          persistedDailyHistory: []
        } as any,
        [{ id: 'task-1' }] as any
      )
    ).toBe(false);
  });
});
