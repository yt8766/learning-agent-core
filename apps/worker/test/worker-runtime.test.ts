import { describe, expect, it } from 'vitest';

import { createWorkerRuntimeHost, startWorkerProcess } from '../src/runtime/worker-runtime';

describe('worker runtime', () => {
  it('builds a worker runtime host around the platform runtime facade', async () => {
    const host = createWorkerRuntimeHost();

    expect(host.platformRuntime.runtime).toBe(host.runtime);
    expect(host.context.runnerId).toContain('worker-');
    expect(host.context.enabled).toBe(true);

    await host.stop();
  });

  it('uses platform profile and worker-prefixed runner ids', async () => {
    const handle = await startWorkerProcess();

    expect(handle.platformRuntime.runtime).toBe(handle.runtime);
    expect(handle.runtime.settings.profile).toBe('platform');
    expect(handle.context.runnerId).toContain('worker-');
    expect(handle.context.enabled).toBe(true);

    await handle.stop();
  });
});
