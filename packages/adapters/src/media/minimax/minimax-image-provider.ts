import type { ImageGenerationRequest, ImageGenerationResult } from '@agent/core';
import type { ImageProvider } from '@agent/agent-kit';

import type { MiniMaxMediaConfig } from './minimax-config';
import type { MiniMaxMediaTransport } from './minimax-audio-provider';

export class MiniMaxImageProvider implements ImageProvider {
  readonly providerId = 'minimax';

  constructor(
    private readonly transport: MiniMaxMediaTransport,
    private readonly config: MiniMaxMediaConfig = {}
  ) {}

  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    return this.transport.request('image.generateImage', {
      request,
      config: this.config
    });
  }
}
