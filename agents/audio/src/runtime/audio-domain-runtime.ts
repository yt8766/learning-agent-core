import type {
  MediaGenerationTask,
  MusicGenerationRequest,
  MusicGenerationResult,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceCloneRequest,
  VoiceCloneResult,
  VoiceProfile
} from '@agent/core';

export interface MediaTaskQuery {
  readonly taskId: string;
  readonly providerTaskId?: string;
}

export interface ListSystemVoicesInput {
  readonly language?: string;
  readonly provider?: string;
}

export interface ListSystemVoicesResult {
  readonly voices: readonly VoiceProfile[];
}

export interface AudioProvider {
  readonly providerId: string;
  listSystemVoices(input?: ListSystemVoicesInput): Promise<ListSystemVoicesResult>;
  cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResult>;
  synthesizeSpeech(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult>;
  createSpeechTask(request: SpeechSynthesisRequest): Promise<MediaGenerationTask>;
  getSpeechTask(query: MediaTaskQuery): Promise<MediaGenerationTask>;
}

export interface LyricsGenerationInput {
  readonly prompt: string;
  readonly language?: string;
  readonly mood?: string;
  readonly genre?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface LyricsGenerationResult {
  readonly lyrics: string;
  readonly evidenceRefs?: readonly string[];
}

export interface MusicProvider {
  readonly providerId: string;
  generateLyrics(input: LyricsGenerationInput): Promise<LyricsGenerationResult>;
  generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
  createMusicTask(request: MusicGenerationRequest): Promise<MediaGenerationTask>;
  getMusicTask(query: MediaTaskQuery): Promise<MediaGenerationTask>;
}

export interface AudioDomainRuntime {
  audioProvider: AudioProvider;
  musicProvider?: MusicProvider;
}

export function createAudioDomainRuntime(runtime: AudioDomainRuntime): AudioDomainRuntime {
  return runtime;
}
