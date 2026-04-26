import type { MediaGenerationTask, MusicGenerationRequest, MusicGenerationResult } from '@agent/core';

import type { MiniMaxMediaConfig } from './minimax-config';
import { resolveMiniMaxMusicModel } from './minimax-config';
import type { MiniMaxMediaTaskQuery, MiniMaxMediaTransport } from './minimax-audio-provider';

export interface MiniMaxLyricsGenerationInput {
  readonly prompt: string;
  readonly language?: string;
  readonly mood?: string;
  readonly genre?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface MiniMaxLyricsGenerationResult {
  readonly lyrics: string;
  readonly evidenceRefs?: readonly string[];
}

export class MiniMaxMusicProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  generateLyrics(input: MiniMaxLyricsGenerationInput): Promise<MiniMaxLyricsGenerationResult> {
    return this.transport.request('music.generateLyrics', {
      provider: this.providerId,
      model: resolveMiniMaxMusicModel(this.config),
      input
    });
  }

  generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    return this.transport.request('music.generateMusic', {
      provider: this.providerId,
      model: resolveMiniMaxMusicModel(this.config),
      input: request
    });
  }

  createMusicTask(request: MusicGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request('music.createMusicTask', {
      provider: this.providerId,
      model: resolveMiniMaxMusicModel(this.config),
      input: request
    });
  }

  getMusicTask(query: MiniMaxMediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('music.getMusicTask', {
      provider: this.providerId,
      model: resolveMiniMaxMusicModel(this.config),
      query
    });
  }
}
