import { describe, expect, it } from 'vitest';

import { startWorkerProcess } from '../src/runtime/worker-runtime';

describe('worker runtime', () => {
  it('uses platform profile and worker-prefixed runner ids', async () => {
    const handle = await startWorkerProcess();

    expect(handle.runtime.settings.profile).toBe('platform');
    expect(handle.context.runnerId).toContain('worker-');
    expect(handle.context.enabled).toBe(true);

    await handle.stop();
  });
});
