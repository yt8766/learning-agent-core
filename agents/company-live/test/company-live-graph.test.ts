import { describe, expect, it } from 'vitest';

import { createMediaProviderRegistry } from '@agent/runtime';

import { executeCompanyLiveGraph } from '../src';

function makeStubRegistry() {
  const registry = createMediaProviderRegistry();

  registry.registerAudioProvider({
    providerId: 'stub',
    listSystemVoices: async () => ({ voices: [] }),
    cloneVoice: async () => ({
      voiceId: 'stub-voice-1',
      voiceOwner: 'Stub',
      status: 'ready' as const
    }),
    synthesizeSpeech: async req => ({
      asset: {
        assetId: `asset-audio-stub-${req.text.slice(0, 5)}`,
        kind: 'audio' as const,
        uri: `memory://stub/audio.mp3`,
        mimeType: 'audio/mpeg',
        provider: 'minimax' as const,
        createdAt: new Date().toISOString()
      }
    }),
    createSpeechTask: async req => ({
      taskId: 'task-audio-1',
      kind: 'audio' as const,
      provider: 'minimax' as const,
      status: 'succeeded' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    getSpeechTask: async q => ({
      taskId: q.taskId,
      kind: 'audio' as const,
      provider: 'minimax' as const,
      status: 'succeeded' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  });

  registry.registerImageProvider({
    providerId: 'stub',
    generateImage: async () => ({
      assets: [
        {
          assetId: 'asset-image-stub-1',
          kind: 'image' as const,
          uri: `memory://stub/image.webp`,
          mimeType: 'image/webp',
          provider: 'minimax' as const,
          createdAt: new Date().toISOString()
        }
      ]
    })
  });

  registry.registerVideoProvider({
    providerId: 'stub',
    createVideoTask: async () => ({
      taskId: 'task-video-1',
      kind: 'video' as const,
      provider: 'minimax' as const,
      status: 'succeeded' as const,
      assetRefs: ['asset-video-stub-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    createTemplateVideoTask: async () => ({
      taskId: 'task-video-tmpl-1',
      kind: 'video' as const,
      provider: 'minimax' as const,
      status: 'succeeded' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    getVideoTask: async q => ({
      taskId: q.taskId,
      kind: 'video' as const,
      provider: 'minimax' as const,
      status: 'succeeded' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  });

  return registry;
}

const stubBrief = {
  briefId: 'brief-test-1',
  targetPlatform: 'TikTok',
  targetRegion: 'US',
  language: 'en-US',
  audienceProfile: 'US shoppers',
  productRefs: ['sku-1'],
  sellingPoints: ['Fast glow'],
  riskLevel: 'medium' as const,
  createdAt: '2026-04-29T00:00:00.000Z'
};

describe('executeCompanyLiveGraph', () => {
  it('returns a bundle with all 3 asset kinds', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);

    expect(result.bundle.bundleId).toBeTruthy();
    expect(result.bundle.assets).toHaveLength(3);

    const kinds = result.bundle.assets.map(a => a.kind);
    expect(kinds).toContain('audio');
    expect(kinds).toContain('image');
    expect(kinds).toContain('video');
  });

  it('returns trace with 4 entries (generateAudio, generateImage, generateVideo, assembleBundle)', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);

    expect(result.trace).toHaveLength(4);

    const nodeIds = result.trace.map(t => t.nodeId);
    expect(nodeIds).toContain('generateAudio');
    expect(nodeIds).toContain('generateImage');
    expect(nodeIds).toContain('generateVideo');
    expect(nodeIds).toContain('assembleBundle');
  });

  it('all trace entries have status succeeded', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);

    for (const entry of result.trace) {
      expect(entry.status).toBe('succeeded');
    }
  });

  it('each trace entry has non-negative durationMs', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);

    for (const entry of result.trace) {
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('trace entries have inputSnapshot and outputSnapshot', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);

    for (const entry of result.trace) {
      expect(entry.inputSnapshot).toBeDefined();
      expect(entry.outputSnapshot).toBeDefined();
      expect(typeof entry.inputSnapshot).toBe('object');
      expect(typeof entry.outputSnapshot).toBe('object');
    }
  });
});

describe('executeCompanyLiveGraph with progressCallback', () => {
  it('calls onNodeComplete for each completed node', async () => {
    const registry = makeStubRegistry();
    const completed: string[] = [];

    await executeCompanyLiveGraph(stubBrief, registry, {
      onNodeComplete: trace => {
        completed.push(trace.nodeId);
      }
    });

    expect(completed).toEqual(['generateAudio', 'generateImage', 'generateVideo', 'assembleBundle']);
  });

  it('backward compatible: works without options', async () => {
    const registry = makeStubRegistry();
    const result = await executeCompanyLiveGraph(stubBrief, registry);
    expect(result.trace).toHaveLength(4);
  });
});
