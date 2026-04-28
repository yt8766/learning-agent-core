import type { MediaGenerationTask, MusicGenerationRequest, MusicGenerationResult } from '@agent/core';

import type { MediaTaskQuery } from './media-task-query';

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
