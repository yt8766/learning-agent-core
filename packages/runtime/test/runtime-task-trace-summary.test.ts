import { describe, expect, it } from 'vitest';

import { buildRecentTraceSummaryLines } from '../src/runtime/runtime-task-trace-summary';

describe('runtime task trace summary', () => {
  it('formats the most recent trace lines in chronological slice order', () => {
    const lines = buildRecentTraceSummaryLines(
      {
        trace: [
          { at: '2026-04-01T10:00:00.000Z', node: 'plan', summary: 'created plan' },
          { at: '2026-04-01T10:01:00.000Z', node: 'execute', summary: 'ran command' },
          { at: '2026-04-01T10:02:00.000Z', node: 'review', summary: 'checked result' }
        ]
      } as any,
      2
    );

    expect(lines).toEqual([
      '2026-04-01T10:01:00.000Z / execute / ran command',
      '2026-04-01T10:02:00.000Z / review / checked result'
    ]);
  });
});
