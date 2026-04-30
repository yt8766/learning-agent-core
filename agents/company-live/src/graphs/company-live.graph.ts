import type { CompanyLiveContentBrief, CompanyLiveGenerateResult, CompanyLiveNodeTrace } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import { assembleBundleNode, generateAudioNode, generateImageNode, generateVideoNode } from '../flows/media/nodes';
import type { CompanyLiveGraphState } from '../flows/media/nodes';

export interface CompanyLiveGraphOptions {
  onNodeComplete?: (trace: CompanyLiveNodeTrace) => void;
}

export async function executeCompanyLiveGraph(
  brief: CompanyLiveContentBrief,
  registry: MediaProviderRegistry,
  options?: CompanyLiveGraphOptions
): Promise<CompanyLiveGenerateResult> {
  let state: CompanyLiveGraphState = {
    brief,
    audioAsset: null,
    imageAsset: null,
    videoAsset: null,
    bundle: null,
    trace: []
  };

  const audioUpdate = await generateAudioNode(state, registry);
  state = { ...state, ...audioUpdate, trace: audioUpdate.trace ?? state.trace };
  const audioTrace = state.trace[state.trace.length - 1];
  if (audioTrace) options?.onNodeComplete?.(audioTrace);

  const imageUpdate = await generateImageNode(state, registry);
  state = { ...state, ...imageUpdate, trace: imageUpdate.trace ?? state.trace };
  const imageTrace = state.trace[state.trace.length - 1];
  if (imageTrace) options?.onNodeComplete?.(imageTrace);

  const videoUpdate = await generateVideoNode(state, registry);
  state = { ...state, ...videoUpdate, trace: videoUpdate.trace ?? state.trace };
  const videoTrace = state.trace[state.trace.length - 1];
  if (videoTrace) options?.onNodeComplete?.(videoTrace);

  const bundleUpdate = assembleBundleNode(state);
  state = { ...state, ...bundleUpdate, trace: bundleUpdate.trace ?? state.trace };
  const bundleTrace = state.trace[state.trace.length - 1];
  if (bundleTrace) options?.onNodeComplete?.(bundleTrace);

  if (!state.bundle) {
    throw new Error('company-live graph: assembleBundle produced no bundle');
  }

  return { bundle: state.bundle, trace: state.trace };
}
