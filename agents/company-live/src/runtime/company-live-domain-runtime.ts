import type { MediaAsset } from '@agent/core';
import { createMediaProviderRegistry } from '@agent/runtime';
import type { MediaProviderRegistry } from '@agent/runtime';

function makeStubAudioAsset(briefId: string): MediaAsset {
  return {
    assetId: `asset-audio-stub-${briefId}`,
    kind: 'audio',
    uri: `memory://stub/audio-${briefId}.mp3`,
    mimeType: 'audio/mpeg',
    provider: 'minimax',
    createdAt: new Date().toISOString()
  };
}

function makeStubImageAsset(briefId: string): MediaAsset {
  return {
    assetId: `asset-image-stub-${briefId}`,
    kind: 'image',
    uri: `memory://stub/image-${briefId}.webp`,
    mimeType: 'image/webp',
    provider: 'minimax',
    createdAt: new Date().toISOString()
  };
}

export function createCompanyLiveStubRegistry(): MediaProviderRegistry {
  const registry = createMediaProviderRegistry();

  registry.registerAudioProvider({
    providerId: 'stub',
    listSystemVoices: async () => ({ voices: [] }),
    cloneVoice: async () => ({
      voiceId: 'stub-voice-1',
      provider: 'minimax' as const,
      consentEvidenceRef: 'ev-stub-consent-1'
    }),
    synthesizeSpeech: async req => ({
      asset: makeStubAudioAsset(req.text.slice(0, 8).replace(/\s/g, '-'))
    }),
    createSpeechTask: async () => ({
      taskId: 'task-audio-stub-1',
      kind: 'audio',
      provider: 'minimax',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    getSpeechTask: async q => ({
      taskId: q.taskId,
      kind: 'audio',
      provider: 'minimax',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  });

  registry.registerImageProvider({
    providerId: 'stub',
    generateImage: async req => ({
      assets: [makeStubImageAsset(req.prompt.slice(0, 8).replace(/\s/g, '-'))]
    })
  });

  registry.registerVideoProvider({
    providerId: 'stub',
    createVideoTask: async () => ({
      taskId: 'task-video-stub-1',
      kind: 'video',
      provider: 'minimax',
      status: 'succeeded',
      assetRefs: ['asset-video-stub-1'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    createTemplateVideoTask: async () => ({
      taskId: 'task-video-tmpl-stub-1',
      kind: 'video',
      provider: 'minimax',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    getVideoTask: async q => ({
      taskId: q.taskId,
      kind: 'video',
      provider: 'minimax',
      status: 'succeeded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  });

  return registry;
}
