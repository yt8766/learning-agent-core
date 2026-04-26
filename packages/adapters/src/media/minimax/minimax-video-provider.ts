import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';
import type { MediaTaskQuery, VideoProvider } from '@agent/agent-kit';

import type { MiniMaxMediaConfig } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxVideoProvider implements VideoProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly transport: MiniMaxMediaTransport,
    private readonly config: MiniMaxMediaConfig = {}
  ) {}

  createVideoTask(request: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request('video.createVideoTask', {
      request,
      config: this.config
    });
  }

  createTemplateVideoTask(request: TemplateVideoRequest): Promise<MediaGenerationTask> {
    return this.transport.request('video.createTemplateVideoTask', {
      request,
      config: this.config
    });
  }

  getVideoTask(query: MediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('video.getVideoTask', {
      query,
      config: this.config
    });
  }
}
