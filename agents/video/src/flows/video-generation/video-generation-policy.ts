import { VideoGenerationRequestSchema, type VideoGenerationRequest } from '@agent/core';

export function assertVideoGenerationRequestAllowed(input: VideoGenerationRequest): VideoGenerationRequest {
  if (input.durationMs !== undefined && input.durationMs > 300000) {
    throw new Error('Video duration must not exceed 300 seconds.');
  }
  if (input.imageAssetRefs !== undefined && input.imageAssetRefs.length > 10) {
    throw new Error('Video generation accepts at most 10 image asset refs.');
  }
  return VideoGenerationRequestSchema.parse(input);
}
