import { describe, expect, it, vi } from 'vitest';

import { RuntimeIntelSchedulerService } from '../../../src/runtime/intel/runtime-intel-scheduler.service';

describe('RuntimeIntelSchedulerService', () => {
  it('starts and stops the Bree scheduler when explicitly enabled', async () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);

    const service = new RuntimeIntelSchedulerService(
      {
        settings: {
          workspaceRoot: '/workspace/project'
        }
      } as never,
      {
        env: {
          INTEL_SCHEDULER_ENABLED: 'true'
        },
        createScheduler: () =>
          ({
            start,
            stop
          }) as never
      }
    );

    await service.onModuleInit();
    expect(start).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stays idle when the intel scheduler flag is not enabled', async () => {
    const start = vi.fn(async () => undefined);

    const service = new RuntimeIntelSchedulerService(
      {
        settings: {
          workspaceRoot: '/workspace/project'
        }
      } as never,
      {
        env: {},
        createScheduler: () =>
          ({
            start,
            stop: vi.fn(async () => undefined)
          }) as never
      }
    );

    await service.onModuleInit();
    expect(start).not.toHaveBeenCalled();
  });
});
