import type { CompanyLiveGraphState } from './graph-state';

export function assembleBundleNode(state: CompanyLiveGraphState): Partial<CompanyLiveGraphState> {
  const assets = [state.audioAsset, state.imageAsset, state.videoAsset].filter(
    (a): a is NonNullable<typeof a> => a !== null
  );

  const inputSnapshot = { assetCount: assets.length };
  const start = Date.now();

  const bundle = {
    bundleId: `bundle-${state.brief.briefId}`,
    requestId: `req-${state.brief.briefId}`,
    sourceBriefId: state.brief.briefId,
    assets,
    createdAt: new Date().toISOString()
  };

  const durationMs = Date.now() - start;

  return {
    bundle,
    trace: [
      ...state.trace,
      {
        nodeId: 'assembleBundle',
        status: 'succeeded',
        durationMs,
        inputSnapshot,
        outputSnapshot: { bundleId: bundle.bundleId, assetCount: bundle.assets.length }
      }
    ]
  };
}
