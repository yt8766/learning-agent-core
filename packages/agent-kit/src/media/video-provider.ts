import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';

import type { MediaTaskQuery } from './audio-provider';

export interface VideoProvider {
  readonly providerId: string;
  createVideoTask(request: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createTemplateVideoTask(request: TemplateVideoRequest): Promise<MediaGenerationTask>;
  getVideoTask(query: MediaTaskQuery): Promise<MediaGenerationTask>;
}
