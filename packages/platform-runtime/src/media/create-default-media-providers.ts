import {
  DEFAULT_MINIMAX_IMAGE_MODEL,
  DEFAULT_MINIMAX_MEDIA_BASE_URL,
  DEFAULT_MINIMAX_SPEECH_MODEL,
  DEFAULT_MINIMAX_VIDEO_MODEL,
  MiniMaxAudioProvider,
  MiniMaxImageProvider,
  MiniMaxMusicProvider,
  MiniMaxVideoProvider,
  type MiniMaxMediaConfig,
  type MiniMaxMediaTransport
} from '@agent/adapters';

import { createMediaProviderRegistry, type MediaProviderRegistry } from './media-provider-registry';

export interface DefaultMediaProvidersInput extends Partial<MiniMaxMediaConfig> {
  readonly apiKey: string;
  readonly transport?: MiniMaxMediaTransport;
}

export interface DefaultMediaProviders {
  readonly registry: MediaProviderRegistry;
  readonly config: MiniMaxMediaConfig;
}

export function createDefaultMediaProviders(input: DefaultMediaProvidersInput): DefaultMediaProviders {
  const { transport, ...configInput } = input;
  const config: MiniMaxMediaConfig = {
    apiKey: configInput.apiKey,
    baseUrl: configInput.baseUrl ?? DEFAULT_MINIMAX_MEDIA_BASE_URL,
    speechModel: configInput.speechModel ?? DEFAULT_MINIMAX_SPEECH_MODEL,
    imageModel: configInput.imageModel ?? DEFAULT_MINIMAX_IMAGE_MODEL,
    videoModel: configInput.videoModel ?? DEFAULT_MINIMAX_VIDEO_MODEL,
    musicModel: configInput.musicModel
  };
  const mediaTransport = transport ?? createNoopTransport();
  const registry = createMediaProviderRegistry();

  registry.registerAudioProvider(new MiniMaxAudioProvider(config, mediaTransport));
  registry.registerImageProvider(new MiniMaxImageProvider(config, mediaTransport));
  registry.registerVideoProvider(new MiniMaxVideoProvider(config, mediaTransport));
  registry.registerMusicProvider(new MiniMaxMusicProvider(config, mediaTransport));

  return { registry, config };
}

export function createNoopTransport(): MiniMaxMediaTransport {
  return {
    request() {
      throw new Error('MiniMax media transport is not configured for real provider calls.');
    }
  };
}
