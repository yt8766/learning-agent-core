import { describe, expect, it } from 'vitest';
import { createMediaProviderRegistry } from '../src';

describe('@agent/runtime media provider registry', () => {
  it('registers and resolves named media providers', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider = {
      providerId: 'mock-audio',
      async listSystemVoices() {
        return { voices: [] };
      },
      async cloneVoice() {
        throw new Error('not used');
      },
      async synthesizeSpeech() {
        return { assetId: 'asset-1', evidenceRefs: [] };
      },
      async createSpeechTask() {
        throw new Error('not used');
      },
      async getSpeechTask() {
        throw new Error('not used');
      }
    };

    registry.registerAudioProvider(audioProvider);

    expect(await registry.getAudioProvider('mock-audio')).toBe(audioProvider);
    await expect(registry.getAudioProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });
});
