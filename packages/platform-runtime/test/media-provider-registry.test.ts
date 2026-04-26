import { describe, expect, it } from 'vitest';

import { createDefaultMediaProviders } from '../src';

describe('@agent/platform-runtime media providers', () => {
  it('registers MiniMax as the default media provider set', async () => {
    const providers = createDefaultMediaProviders({
      apiKey: 'test-key',
      baseUrl: 'https://example.invalid',
      speechModel: 'speech-2.8-turbo',
      imageModel: 'image-01',
      videoModel: 'MiniMax-Hailuo-2.3'
    });

    expect((await providers.registry.getAudioProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getImageProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getVideoProvider('minimax')).providerId).toBe('minimax');
    expect((await providers.registry.getMusicProvider('minimax')).providerId).toBe('minimax');
  });
});
