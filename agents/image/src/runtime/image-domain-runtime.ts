import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';

export interface ImageProvider {
  readonly providerId: string;
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export interface ImageDomainRuntime {
  imageProvider: ImageProvider;
}

export function createImageDomainRuntime(runtime: ImageDomainRuntime): ImageDomainRuntime {
  return runtime;
}
