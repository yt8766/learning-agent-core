import { describe, expect, it } from 'vitest';

import { createMediaProviderRegistry, type AudioProvider } from '../src';

describe('@agent/agent-kit media provider registry', () => {
  it('registers and resolves named media providers', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider: AudioProvider = {
      providerId: 'mock-audio',
      async listSystemVoices() {
        return { voices: [] };
      },
      async cloneVoice() {
        throw new Error('not used');
      },
      async synthesizeSpeech() {
        return {
          asset: {
            assetId: 'asset-1',
            kind: 'audio',
            uri: 'memory://asset-1',
            mimeType: 'audio/wav',
            createdAt: '2026-04-26T00:00:00.000Z'
          },
          evidenceRefs: []
        };
      },
      async createSpeechTask() {
        throw new Error('not used');
      },
      async getSpeechTask() {
        throw new Error('not used');
      }
    };

    registry.registerAudioProvider(audioProvider);

    expect(registry.getAudioProvider('mock-audio')).toBe(audioProvider);
    await expect(registry.getAudioProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });
});
