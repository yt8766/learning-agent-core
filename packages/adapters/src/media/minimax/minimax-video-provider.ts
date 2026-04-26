import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';

import type { MiniMaxMediaConfig } from './minimax-config';
import { resolveMiniMaxVideoModel } from './minimax-config';
import type { MiniMaxMediaTaskQuery, MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxVideoProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  createVideoTask(request: VideoGenerationRequest): Promise<MediaGenerationTask> {
    return this.transport.request('video.createVideoTask', {
      provider: this.providerId,
      model: this.videoModel,
      input: request
    });
  }

  createTemplateVideoTask(request: TemplateVideoRequest): Promise<MediaGenerationTask> {
    return this.transport.request('video.createTemplateVideoTask', {
      provider: this.providerId,
      model: this.videoModel,
      input: request
    });
  }

  getVideoTask(query: MiniMaxMediaTaskQuery): Promise<MediaGenerationTask> {
    return this.transport.request('video.getVideoTask', {
      provider: this.providerId,
      model: this.videoModel,
      query
    });
  }

  private get videoModel(): string {
    return resolveMiniMaxVideoModel(this.config);
  }
}
