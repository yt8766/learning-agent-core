import { describe, expect, it } from 'vitest';

import { resolvePersistedLogChannels } from '../../src/logger/log-persistence';

describe('resolvePersistedLogChannels', () => {
  it('skips ordinary info and warn logs that are not explicitly whitelisted', () => {
    expect(
      resolvePersistedLogChannels({
        level: 'info',
        message: 'AppModule dependencies initialized',
        meta: { context: 'InstanceLoader' }
      })
    ).toEqual([]);

    expect(
      resolvePersistedLogChannels({
        level: 'warn',
        message: { event: 'request.warned', statusCode: 429 },
        meta: { context: 'LoggerMiddleware' }
      })
    ).toEqual([]);
  });

  it('persists only the targeted warn, audit, performance, and error channels', () => {
    expect(
      resolvePersistedLogChannels({
        level: 'warn',
        message: { event: 'runtime.schedule.tick_failed', statusCode: 503 },
        meta: { context: 'RuntimeScheduleService' }
      })
    ).toEqual(['warn']);

    expect(
      resolvePersistedLogChannels({
        level: 'info',
        message: { event: 'approval-policy.revoked' },
        meta: { context: 'LoggerMiddleware' }
      })
    ).toEqual(['audit']);

    expect(
      resolvePersistedLogChannels({
        level: 'warn',
        message: { event: 'runtime.platform_console.slow', totalDurationMs: 1300 },
        meta: { context: 'RuntimeCentersQueryService' }
      })
    ).toEqual(['performance']);

    expect(
      resolvePersistedLogChannels({
        level: 'error',
        message: { event: 'runtime.platform_console.failed', statusCode: 500 },
        meta: { context: 'RuntimeCentersQueryService' }
      })
    ).toEqual(['error']);
  });
});
