import { describe, expect, it } from 'vitest';

import { createAudioDomainRuntime, type AudioDomainRuntime, type AudioProvider } from '../src';

function makeAudioProvider(): AudioProvider {
  return {
    providerId: 'test-audio',
    async listSystemVoices() {
      return { voices: [] };
    },
    async cloneVoice() {
      return { voiceId: 'v1', provider: 'test-audio' as unknown as string, consentEvidenceRef: 'ref-1' };
    },
    async synthesizeSpeech() {
      return { asset: { id: 'a1' } } as unknown as Awaited<ReturnType<AudioProvider['synthesizeSpeech']>>;
    },
    async createSpeechTask() {
      return { taskId: 't1', status: 'completed' } as unknown as Awaited<ReturnType<AudioProvider['createSpeechTask']>>;
    },
    async getSpeechTask() {
      return { taskId: 't1', status: 'completed' } as unknown as Awaited<ReturnType<AudioProvider['getSpeechTask']>>;
    }
  };
}

describe('createAudioDomainRuntime', () => {
  it('returns the runtime object as-is (passthrough factory)', () => {
    const audioProvider = makeAudioProvider();
    const runtime = createAudioDomainRuntime({ audioProvider });

    expect(runtime.audioProvider).toBe(audioProvider);
    expect(runtime.audioProvider.providerId).toBe('test-audio');
  });

  it('includes musicProvider when provided', () => {
    const audioProvider = makeAudioProvider();
    const musicProvider = {
      providerId: 'test-music',
      async generateLyrics() {
        return { lyrics: 'test lyrics' };
      },
      async generateMusic() {
        return { trackId: 'track-1' } as unknown as Awaited<
          ReturnType<NonNullable<AudioDomainRuntime['musicProvider']>['generateMusic']>
        >;
      },
      async createMusicTask() {
        return { taskId: 'mt-1', status: 'completed' } as unknown as Awaited<
          ReturnType<NonNullable<AudioDomainRuntime['musicProvider']>['createMusicTask']>
        >;
      },
      async getMusicTask() {
        return { taskId: 'mt-1', status: 'completed' } as unknown as Awaited<
          ReturnType<NonNullable<AudioDomainRuntime['musicProvider']>['getMusicTask']>
        >;
      }
    };

    const runtime = createAudioDomainRuntime({ audioProvider, musicProvider });
    expect(runtime.musicProvider).toBe(musicProvider);
    expect(runtime.musicProvider?.providerId).toBe('test-music');
  });

  it('musicProvider is optional', () => {
    const runtime = createAudioDomainRuntime({ audioProvider: makeAudioProvider() });
    expect(runtime.musicProvider).toBeUndefined();
  });
});
