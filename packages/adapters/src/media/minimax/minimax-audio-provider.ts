import type {
  MediaGenerationTask,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceCloneRequest,
  VoiceCloneResult
} from '@agent/core';
import type { AudioProvider, ListSystemVoicesInput, ListSystemVoicesResult, MediaTaskQuery } from '@agent/agent-kit';

import type { MiniMaxMediaConfig } from './minimax-config';

export interface MiniMaxMediaTransport {
  request<T>(operation: string, payload: unknown): Promise<T>;
}

export class MiniMaxAudioProvider implements AudioProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly transport: MiniMaxMediaTransport,
    private readonly config: MiniMaxMediaConfig = {}
  ) {}

  listSystemVoices(input: ListSystemVoicesInput = {}): Promise<ListSystemVoicesResult> {
    return this.transport.request('audio.listSystemVoices', {
      ...input,
      config: this.config
    });
  }

  cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResult> {
    return this.transport.request('audio.cloneVoice', {
      request,
      config: this.config
    });
  }

  synthesizeSpeech(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    return this.transport.request('audio.synthesizeSpeech', {
      request,
      config: this.config
    });
  }

  createSpeechTask(request: SpeechSynthesisRequest): Promise<MediaGenerationTask> {
    return this.transport.request('audio.createSpeechTask', {
      request,
      config: this.config
    });
  }

  getSpeechTask(query: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('audio.getSpeechTask', {
      query,
      config: this.config
    });
  }
}
