import type { AudioProvider, MusicProvider } from '@agent/agent-kit';

export interface AudioDomainRuntime {
  audioProvider: AudioProvider;
  musicProvider?: MusicProvider;
}

export function createAudioDomainRuntime(runtime: AudioDomainRuntime): AudioDomainRuntime {
  return runtime;
}
