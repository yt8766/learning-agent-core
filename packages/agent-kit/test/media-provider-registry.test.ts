import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createMediaProviderRegistry,
  type AudioProvider,
  type ImageProvider,
  type MediaProviderRegistry,
  type MusicProvider,
  type VideoProvider
} from '../src';

const createAudioProvider = (providerId: string): AudioProvider => ({
  providerId,
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
});

const createImageProvider = (providerId: string): ImageProvider => ({
  providerId,
  async generateImage() {
    return { assets: [], evidenceRefs: [] };
  }
});

const createVideoProvider = (providerId: string): VideoProvider => ({
  providerId,
  async createVideoTask() {
    throw new Error('not used');
  },
  async createTemplateVideoTask() {
    throw new Error('not used');
  },
  async getVideoTask() {
    throw new Error('not used');
  }
});

const createMusicProvider = (providerId: string): MusicProvider => ({
  providerId,
  async generateLyrics() {
    return { lyrics: '', evidenceRefs: [] };
  },
  async generateMusic() {
    throw new Error('not used');
  },
  async createMusicTask() {
    throw new Error('not used');
  },
  async getMusicTask() {
    throw new Error('not used');
  }
});

describe('@agent/agent-kit media provider registry', () => {
  it('registers and resolves named audio providers', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider = createAudioProvider('mock-audio');

    registry.registerAudioProvider(audioProvider);

    expectTypeOf<MediaProviderRegistry['getAudioProvider']>().returns.toEqualTypeOf<Promise<AudioProvider>>();
    await expect(registry.getAudioProvider('mock-audio')).resolves.toBe(audioProvider);
    await expect(registry.getAudioProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });

  it('registers and resolves named image providers', async () => {
    const registry = createMediaProviderRegistry();
    const imageProvider = createImageProvider('mock-image');

    registry.registerImageProvider(imageProvider);

    expectTypeOf<MediaProviderRegistry['getImageProvider']>().returns.toEqualTypeOf<Promise<ImageProvider>>();
    await expect(registry.getImageProvider('mock-image')).resolves.toBe(imageProvider);
    await expect(registry.getImageProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });

  it('registers and resolves named video providers', async () => {
    const registry = createMediaProviderRegistry();
    const videoProvider = createVideoProvider('mock-video');

    registry.registerVideoProvider(videoProvider);

    expectTypeOf<MediaProviderRegistry['getVideoProvider']>().returns.toEqualTypeOf<Promise<VideoProvider>>();
    await expect(registry.getVideoProvider('mock-video')).resolves.toBe(videoProvider);
    await expect(registry.getVideoProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });

  it('registers and resolves named music providers', async () => {
    const registry = createMediaProviderRegistry();
    const musicProvider = createMusicProvider('mock-music');

    registry.registerMusicProvider(musicProvider);

    expectTypeOf<MediaProviderRegistry['getMusicProvider']>().returns.toEqualTypeOf<Promise<MusicProvider>>();
    await expect(registry.getMusicProvider('mock-music')).resolves.toBe(musicProvider);
    await expect(registry.getMusicProvider('missing')).rejects.toThrow('Media provider not found: missing');
  });

  it('keeps providers with the same id isolated by media kind', async () => {
    const registry = createMediaProviderRegistry();
    const audioProvider = createAudioProvider('minimax');
    const imageProvider = createImageProvider('minimax');
    const videoProvider = createVideoProvider('minimax');
    const musicProvider = createMusicProvider('minimax');

    registry.registerAudioProvider(audioProvider);
    registry.registerImageProvider(imageProvider);
    registry.registerVideoProvider(videoProvider);
    registry.registerMusicProvider(musicProvider);

    await expect(registry.getAudioProvider('minimax')).resolves.toBe(audioProvider);
    await expect(registry.getImageProvider('minimax')).resolves.toBe(imageProvider);
    await expect(registry.getVideoProvider('minimax')).resolves.toBe(videoProvider);
    await expect(registry.getMusicProvider('minimax')).resolves.toBe(musicProvider);
  });
});
