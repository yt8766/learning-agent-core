import { describe, expect, it } from 'vitest';

import { createIntelScheduler } from '../../../src/runtime/intel/intel-scheduler';

describe('createIntelScheduler', () => {
  it('registers the expected Bree intel jobs', () => {
    const scheduler = createIntelScheduler({
      workspaceRoot: '/workspace/project'
    });
    const jobs = scheduler.config.jobs.filter(job => typeof job !== 'string');
    const jobNames = jobs.map(job => job.name);

    expect(jobNames).toEqual(
      expect.arrayContaining(['intel-patrol', 'intel-ingest', 'intel-digest', 'intel-delivery-retry'])
    );
    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'intel-patrol',
          cron: '*/30 * * * *',
          worker: expect.objectContaining({
            workerData: expect.objectContaining({
              jobName: 'intel-patrol',
              workspaceRoot: '/workspace/project'
            })
          })
        }),
        expect.objectContaining({
          name: 'intel-ingest',
          cron: '0 */3 * * *'
        }),
        expect.objectContaining({
          name: 'intel-digest',
          cron: '0 21 * * *'
        }),
        expect.objectContaining({
          name: 'intel-delivery-retry',
          cron: '*/15 * * * *'
        })
      ])
    );
  });
});
