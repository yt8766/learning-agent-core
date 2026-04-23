import { describe, expect, it } from 'vitest';

import { filterBriefingRunsByWindow } from '../../src/runtime-observability/runtime-briefing-runs';

describe('runtime briefing runs', () => {
  it('filters briefing runs by lookback window and category projection', () => {
    const result = filterBriefingRunsByWindow(
      [
        {
          id: 'run-1',
          runAt: '2026-04-19T10:00:00.000Z',
          status: 'sent',
          categories: [
            {
              category: 'general-security',
              status: 'sent',
              title: 'Security',
              itemCount: 1,
              sent: true,
              emptyDigest: false,
              sourcesChecked: []
            },
            {
              category: 'frontend-tech',
              status: 'sent',
              title: 'Frontend',
              itemCount: 1,
              sent: true,
              emptyDigest: false,
              sourcesChecked: []
            }
          ]
        },
        {
          id: 'run-2',
          runAt: '2026-04-09T10:00:00.000Z',
          status: 'sent',
          categories: [
            {
              category: 'general-security',
              status: 'sent',
              title: 'Older security',
              itemCount: 1,
              sent: true,
              emptyDigest: false,
              sourcesChecked: []
            }
          ]
        }
      ],
      {
        days: 7,
        category: 'general-security',
        now: new Date('2026-04-19T12:00:00.000Z').getTime()
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'run-1',
        categories: [expect.objectContaining({ category: 'general-security' })]
      })
    ]);
  });
});
