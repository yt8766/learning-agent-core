import { describe, expect, it } from 'vitest';

import { createVideoDomainRuntime, type VideoProvider } from '../src';

function makeVideoProvider(): VideoProvider {
  return {
    providerId: 'test-video',
    async createVideoTask() {
      return { taskId: 'vt-1', status: 'completed' } as unknown as Awaited<
        ReturnType<VideoProvider['createVideoTask']>
      >;
    },
    async createTemplateVideoTask() {
      return { taskId: 'tvt-1', status: 'completed' } as unknown as Awaited<
        ReturnType<VideoProvider['createTemplateVideoTask']>
      >;
    },
    async getVideoTask() {
      return { taskId: 'vt-1', status: 'completed' } as unknown as Awaited<ReturnType<VideoProvider['getVideoTask']>>;
    }
  };
}

describe('createVideoDomainRuntime', () => {
  it('returns the runtime object as-is (passthrough factory)', () => {
    const videoProvider = makeVideoProvider();
    const runtime = createVideoDomainRuntime({ videoProvider });

    expect(runtime.videoProvider).toBe(videoProvider);
    expect(runtime.videoProvider.providerId).toBe('test-video');
  });

  it('exposes the provider methods', () => {
    const runtime = createVideoDomainRuntime({ videoProvider: makeVideoProvider() });

    expect(typeof runtime.videoProvider.createVideoTask).toBe('function');
    expect(typeof runtime.videoProvider.createTemplateVideoTask).toBe('function');
    expect(typeof runtime.videoProvider.getVideoTask).toBe('function');
  });
});
