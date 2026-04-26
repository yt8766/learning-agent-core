import { describe, expect, it } from 'vitest';

import type { MiniMaxMediaTransport } from '@agent/adapters';

import { createDefaultMediaProviders } from '../src';

const speechRequest = {
  text: 'Launch week starts now.',
  language: 'en-US',
  voiceId: 'voice-1',
  useCase: 'company-live-preview'
};

describe('@agent/platform-runtime media providers', () => {
  it('registers MiniMax as the default media provider set without credentials', async () => {
    const providers = createDefaultMediaProviders({
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

  it('redacts credentials from the returned config', () => {
    const providers = createDefaultMediaProviders({
      apiKey: 'test-key'
    });

    expect(providers.config.apiKey).toBe('[redacted]');
  });

  it('delegates provider calls to an injected transport without leaking credentials in payloads', async () => {
    const calls: Array<{ operation: string; payload: unknown }> = [];
    const transport: MiniMaxMediaTransport = {
      async request<T>(operation: string, payload: unknown): Promise<T> {
        calls.push({ operation, payload });

        return {
          asset: {
            assetId: 'asset-1',
            mediaType: 'audio',
            uri: 'https://example.invalid/audio.mp3'
          },
          evidenceRefs: []
        } as T;
      }
    };
    const providers = createDefaultMediaProviders({
      apiKey: 'test-key',
      transport
    });
    const audioProvider = await providers.registry.getAudioProvider('minimax');

    await audioProvider.synthesizeSpeech(speechRequest);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.operation).toBe('audio.synthesizeSpeech');
    expect(JSON.stringify(calls[0]?.payload)).not.toContain('test-key');
    expect(calls[0]?.payload).not.toHaveProperty('apiKey');
  });

  it('throws when provider calls use the default noop transport', async () => {
    const providers = createDefaultMediaProviders({});
    const audioProvider = await providers.registry.getAudioProvider('minimax');

    await expect(Promise.resolve().then(() => audioProvider.synthesizeSpeech(speechRequest))).rejects.toThrow(
      'MiniMax media transport is not configured for real provider calls.'
    );
  });
});
