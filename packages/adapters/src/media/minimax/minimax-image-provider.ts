import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';

import type { MiniMaxMediaConfig } from './minimax-config';
import { resolveMiniMaxImageModel } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxImageProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly config: MiniMaxMediaConfig,
    private readonly transport: MiniMaxMediaTransport
  ) {}

  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return this.transport.request('image.generateImage', {
      provider: this.providerId,
      model: resolveMiniMaxImageModel(this.config),
      input: request
    });
  }
}
