import { ImageGenerationRequestSchema, type ImageGenerationRequest } from '@agent/core';

export function assertImageGenerationRequestAllowed(input: ImageGenerationRequest): ImageGenerationRequest {
  if ((input.count ?? 1) > 4 && !input.evidenceRefs?.length) {
    throw new Error('Image generation evidence is required for bulk requests.');
  }
  return ImageGenerationRequestSchema.parse(input);
}
