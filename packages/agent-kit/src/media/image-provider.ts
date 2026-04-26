import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';

export interface ImageProvider {
  readonly providerId: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}
