import type { AudioProvider } from './audio-provider';
import type { ImageProvider } from './image-provider';
import type { MusicProvider } from './music-provider';
import type { VideoProvider } from './video-provider';

export interface MediaProviderRegistry {
  registerAudioProvider(provider: AudioProvider): void;
  registerImageProvider(provider: ImageProvider): void;
  registerVideoProvider(provider: VideoProvider): void;
  registerMusicProvider(provider: MusicProvider): void;
  getAudioProvider(providerId: string): Promise<AudioProvider>;
  getImageProvider(providerId: string): Promise<ImageProvider>;
  getVideoProvider(providerId: string): Promise<VideoProvider>;
  getMusicProvider(providerId: string): Promise<MusicProvider>;
}

export function createMediaProviderRegistry(): MediaProviderRegistry {
  const audioProviders = new Map<string, AudioProvider>();
  const imageProviders = new Map<string, ImageProvider>();
  const videoProviders = new Map<string, VideoProvider>();
  const musicProviders = new Map<string, MusicProvider>();

  const getProvider = <TProvider>(
    providers: ReadonlyMap<string, TProvider>,
    providerId: string
  ): Promise<TProvider> => {
    const provider = providers.get(providerId);

    if (provider) {
      return Promise.resolve(provider);
    }

    return Promise.reject(new Error(`Media provider not found: ${providerId}`));
  };

  return {
    registerAudioProvider(provider) {
      audioProviders.set(provider.providerId, provider);
    },
    registerImageProvider(provider) {
      imageProviders.set(provider.providerId, provider);
    },
    registerVideoProvider(provider) {
      videoProviders.set(provider.providerId, provider);
    },
    registerMusicProvider(provider) {
      musicProviders.set(provider.providerId, provider);
    },
    getAudioProvider(providerId) {
      return getProvider(audioProviders, providerId);
    },
    getImageProvider(providerId) {
      return getProvider(imageProviders, providerId);
    },
    getVideoProvider(providerId) {
      return getProvider(videoProviders, providerId);
    },
    getMusicProvider(providerId) {
      return getProvider(musicProviders, providerId);
    }
  };
}
