import { describe, expect, it, vi } from 'vitest';

import { resolveRuntimeSchedule } from '../../../src/runtime/schedules/runtime-schedule.helpers';
import { RuntimeScheduleService } from '../../../src/runtime/schedules/runtime-schedule.service';

describe('RuntimeScheduleService', () => {
  it('保留通用 schedule parser 给非 briefing 调度使用', () => {
    expect(resolveRuntimeSchedule('daily 11:00')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '0 11 * * *' })
    );
    expect(resolveRuntimeSchedule('weekday 11:00')).toEqual(
      expect.objectContaining({ mode: 'cron', scheduleValid: true, cron: '0 11 * * 1-5' })
    );
    expect(resolveRuntimeSchedule('manual')).toEqual(expect.objectContaining({ mode: 'manual', scheduleValid: true }));
    expect(resolveRuntimeSchedule('daily nope')).toEqual(
      expect.objectContaining({ mode: 'invalid', scheduleValid: false })
    );
  });

  it('不再注册 legacy briefing schedule，只保留 metrics snapshot refresh', async () => {
    const refreshMetricsSnapshots = vi.fn(async () => ({ refreshed: true }));
    const service = new RuntimeScheduleService(() => ({
      refreshMetricsSnapshots
    }));

    await expect(service.syncSchedules()).resolves.toEqual([]);
    await service.syncMetricsSnapshots(14);

    expect(refreshMetricsSnapshots).toHaveBeenCalledWith(14);
  });
});
