import type { ImageGenerationRequest } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import type { CompanyLiveGraphState } from './graph-state';

export async function generateImageNode(
  state: CompanyLiveGraphState,
  registry: MediaProviderRegistry
): Promise<Partial<CompanyLiveGraphState>> {
  const inputSnapshot = { imageAsset: state.imageAsset };
  const start = Date.now();

  const provider = await registry.getImageProvider('stub');

  const request: ImageGenerationRequest = {
    prompt: state.brief.visualBrief ?? state.brief.sellingPoints.join('. '),
    aspectRatio: '9:16'
  };

  const result = await provider.generateImage(request);
  const imageAsset = result.assets[0] ?? null;
  const durationMs = Date.now() - start;

  if (!imageAsset) {
    return {
      trace: [
        ...state.trace,
        {
          nodeId: 'generateImage',
          status: 'failed' as const,
          durationMs,
          inputSnapshot,
          outputSnapshot: {},
          errorMessage: 'image provider returned empty assets array'
        }
      ]
    };
  }

  return {
    imageAsset,
    trace: [
      ...state.trace,
      {
        nodeId: 'generateImage',
        status: 'succeeded',
        durationMs,
        inputSnapshot,
        outputSnapshot: {
          imageAsset: imageAsset ? { assetId: imageAsset.assetId, kind: imageAsset.kind } : null
        }
      }
    ]
  };
}
