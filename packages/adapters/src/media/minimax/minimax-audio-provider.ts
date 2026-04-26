import type {
  MediaGenerationTask,
  SpeechSynthesisRequest,
  SpeechSynthesisResult,
  VoiceProfile,
  VoiceCloneRequest,
  VoiceCloneResult
} from '@agent/core';

import type { MiniMaxMediaConfig } from './minimax-config';
import { resolveMiniMaxSpeechModel } from './minimax-config';

export interface MiniMaxMediaTransport {
  request<T>(operation: string, payload: unknown): Promise<T>;
}

export interface MiniMaxMediaTaskQuery {
  readonly taskId: string;
  readonly providerTaskId?: string;
}

export interface MiniMaxListSystemVoicesInput {
  readonly language?: string;
  readonly provider?: string;
}

export interface MiniMaxListSystemVoicesResult {
  readonly voices: readonly VoiceProfile[];
}

export class MiniMaxAudioProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  listSystemVoices(input: MiniMaxListSystemVoicesInput = {}): Promise<MiniMaxListSystemVoicesResult> {
    return this.transport.request('audio.listSystemVoices', {
      provider: this.providerId,
      model: this.speechModel,
      input
    });
  }

  cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResult> {
    return this.transport.request('audio.cloneVoice', {
      provider: this.providerId,
      model: this.speechModel,
      input: request
    });
  }

  synthesizeSpeech(request: SpeechSynthesisRequest): Promise<SpeechSynthesisResult> {
    return this.transport.request('audio.synthesizeSpeech', {
      provider: this.providerId,
      model: this.speechModel,
      input: request
    });
  }

  createSpeechTask(request: SpeechSynthesisRequest): Promise<MediaGenerationTask> {
    return this.transport.request('audio.createSpeechTask', {
      provider: this.providerId,
      model: this.speechModel,
      input: request
    });
  }

  getSpeechTask(query: MiniMaxMediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('audio.getSpeechTask', {
      provider: this.providerId,
      model: this.speechModel,
      query
    });
  }

  private get speechModel(): string {
    return resolveMiniMaxSpeechModel(this.config);
  }
}
