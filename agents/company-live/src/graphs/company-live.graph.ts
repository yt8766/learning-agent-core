import type { CompanyLiveContentBrief, CompanyLiveGenerateResult } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import { assembleBundleNode, generateAudioNode, generateImageNode, generateVideoNode } from '../flows/media/nodes';
import type { CompanyLiveGraphState } from '../flows/media/nodes';

export async function executeCompanyLiveGraph(
  brief: CompanyLiveContentBrief,
  registry: MediaProviderRegistry
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

  const imageUpdate = await generateImageNode(state, registry);
  state = { ...state, ...imageUpdate, trace: imageUpdate.trace ?? state.trace };

  const videoUpdate = await generateVideoNode(state, registry);
  state = { ...state, ...videoUpdate, trace: videoUpdate.trace ?? state.trace };

  const bundleUpdate = assembleBundleNode(state);
  state = { ...state, ...bundleUpdate, trace: bundleUpdate.trace ?? state.trace };

  if (!state.bundle) {
    throw new Error('company-live graph: assembleBundle produced no bundle');
  }

  return { bundle: state.bundle, trace: state.trace };
}
