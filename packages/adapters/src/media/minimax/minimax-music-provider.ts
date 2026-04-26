import type { MediaGenerationTask, MusicGenerationRequest, MusicGenerationResult } from '@agent/core';
import type { LyricsGenerationInput, LyricsGenerationResult, MediaTaskQuery, MusicProvider } from '@agent/agent-kit';

import type { MiniMaxMediaConfig } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxMusicProvider implements MusicProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly transport: MiniMaxMediaTransport,
    private readonly config: MiniMaxMediaConfig = {}
  ) {}

  generateLyrics(input: LyricsGenerationInput): Promise<LyricsGenerationResult> {
    return this.transport.request('music.generateLyrics', {
      input,
      config: this.config
    });
  }

  generateMusic(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    return this.transport.request('music.generateMusic', {
      request,
      config: this.config
    });
  }

  createMusicTask(request: MusicGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request('music.createMusicTask', {
      request,
      config: this.config
    });
  }

  getMusicTask(query: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('music.getMusicTask', {
      query,
      config: this.config
    });
  }
}
