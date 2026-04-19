import { describe, expect, it } from 'vitest';

import { buildLearningMemoryStats } from '../src/runtime/runtime-learning-memory-stats';

describe('runtime learning memory stats', () => {
  it('counts invalidated memories and returns recent quarantined items in descending quarantine order', () => {
    const result = buildLearningMemoryStats([
      {
        id: 'memory-invalidated',
        status: 'invalidated',
        createdAt: '2026-04-18T09:00:00.000Z'
      },
      {
        id: 'memory-quarantine-older',
        status: 'active',
        quarantined: true,
        summary: 'older quarantine',
        quarantineCategory: 'staleness',
        quarantinedAt: '2026-04-18T09:00:00.000Z'
      },
      {
        id: 'memory-quarantine-newer',
        status: 'active',
        quarantined: true,
        summary: 'newer quarantine',
        quarantineReason: 'contains runtime noise',
        quarantineCategory: 'runtime_noise',
        quarantineReasonDetail: 'Matched runtime artifact token.',
        quarantineRestoreSuggestion: 'refresh source',
        quarantinedAt: '2026-04-19T09:00:00.000Z'
      }
    ] as any);

    expect(result).toEqual({
      invalidated: 1,
      quarantined: 2,
      recentQuarantined: [
        expect.objectContaining({
          id: 'memory-quarantine-newer',
          quarantineCategory: 'runtime_noise',
          quarantineRestoreSuggestion: 'refresh source'
        }),
        expect.objectContaining({
          id: 'memory-quarantine-older',
          quarantineCategory: 'staleness'
        })
      ]
    });
  });
});
