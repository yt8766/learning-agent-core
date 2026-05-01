import { describe, expect, it } from 'vitest';

import { runWithConcurrency } from '@agent/runtime';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('runtime concurrency helpers', () => {
  it('runs workers with a capped concurrency and preserves input order', async () => {
    let active = 0;
    let maxActive = 0;

    const outcome = await runWithConcurrency(
      [30, 10, 20, 5],
      async (ms, index) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(ms);
        active -= 1;
        return `${index}:${ms}`;
      },
      { maxConcurrency: 2 }
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(outcome.results).toEqual(['0:30', '1:10', '2:20', '3:5']);
    expect(outcome.fulfilledCount).toBe(4);
    expect(outcome.rejectedCount).toBe(0);
    expect(outcome.cancelled).toBe(false);
  });

  it('records rejected workers without stopping unrelated work by default', async () => {
    const outcome = await runWithConcurrency(
      [1, 2, 3],
      async item => {
        if (item === 2) {
          throw new Error('item failed');
        }
        return item * 10;
      },
      { maxConcurrency: 2 }
    );

    expect(outcome.results).toEqual([10, undefined, 30]);
    expect(outcome.fulfilledCount).toBe(2);
    expect(outcome.rejectedCount).toBe(1);
    expect(outcome.settled.map(item => item.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  });

  it('stops claiming new work after the first failure when stopOnError is enabled', async () => {
    const started: number[] = [];

    const outcome = await runWithConcurrency(
      [1, 2, 3],
      async item => {
        started.push(item);
        if (item === 1) {
          throw new Error('stop');
        }
        return item;
      },
      { maxConcurrency: 1, stopOnError: true }
    );

    expect(started).toEqual([1]);
    expect(outcome.results).toEqual([undefined, undefined, undefined]);
    expect(outcome.rejectedCount).toBe(1);
  });

  it('stops claiming work when aborted and reports cancellation', async () => {
    const controller = new AbortController();
    const started: number[] = [];

    const outcome = await runWithConcurrency(
      [1, 2, 3],
      async item => {
        started.push(item);
        controller.abort();
        return item;
      },
      { maxConcurrency: 1, signal: controller.signal }
    );

    expect(started).toEqual([1]);
    expect(outcome.results).toEqual([1, undefined, undefined]);
    expect(outcome.cancelled).toBe(true);
  });

  it('returns an empty outcome for empty input', async () => {
    const outcome = await runWithConcurrency([], async item => item, { maxConcurrency: 3 });

    expect(outcome).toMatchObject({
      results: [],
      settled: [],
      fulfilledCount: 0,
      rejectedCount: 0,
      cancelled: false
    });
  });
});
