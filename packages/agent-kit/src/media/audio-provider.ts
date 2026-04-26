import type {
  MediaGenerationTask,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceCloneRequest,
  VoiceCloneResult,
  VoiceProfile
} from '@agent/core';

import type { MediaTaskQuery } from './media-task-query';

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
