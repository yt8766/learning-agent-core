import type { MediaGenerationTask, TemplateVideoRequest, VideoGenerationRequest } from '@agent/core';

export interface MediaTaskQuery {
  readonly taskId: string;
  readonly providerTaskId?: string;
}

export interface VideoProvider {
  readonly providerId: string;
  createVideoTask(request: VideoGenerationRequest): Promise<MediaGenerationTask>;
  createTemplateVideoTask(request: TemplateVideoRequest): Promise<MediaGenerationTask>;
  getVideoTask(query: MediaTaskQuery): Promise<MediaGenerationTask>;
}

export interface VideoDomainRuntime {
  videoProvider: VideoProvider;
}

export function createVideoDomainRuntime(runtime: VideoDomainRuntime): VideoDomainRuntime {
  return runtime;
}
