import type { VideoGenerationRequest } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import type { CompanyLiveGraphState } from './graph-state';

export async function generateVideoNode(
  state: CompanyLiveGraphState,
  registry: MediaProviderRegistry
): Promise<Partial<CompanyLiveGraphState>> {
  const inputSnapshot = { videoAsset: state.videoAsset };
  const start = Date.now();

  const provider = await registry.getVideoProvider('stub');

  const imageAssetRefs = state.imageAsset ? [state.imageAsset.assetId] : undefined;
  const audioAssetRefs = state.audioAsset ? [state.audioAsset.assetId] : undefined;

  const request: VideoGenerationRequest = {
    prompt: state.brief.videoBrief ?? state.brief.sellingPoints.join('. '),
    imageAssetRefs,
    audioAssetRefs,
    aspectRatio: '9:16',
    durationMs: 30000
  };

  const task = await provider.createVideoTask(request);
  const durationMs = Date.now() - start;

  const videoAsset = {
    assetId: `asset-video-stub-${state.brief.briefId}`,
    kind: 'video' as const,
    uri: `memory://stub/video-${state.brief.briefId}.mp4`,
    mimeType: 'video/mp4',
    provider: 'minimax' as const,
    createdAt: new Date().toISOString()
  };

  return {
    videoAsset,
    trace: [
      ...state.trace,
      {
        nodeId: 'generateVideo',
        status: 'succeeded',
        durationMs,
        inputSnapshot,
        outputSnapshot: { videoAsset: { assetId: videoAsset.assetId, kind: videoAsset.kind }, taskId: task.taskId }
      }
    ]
  };
}
