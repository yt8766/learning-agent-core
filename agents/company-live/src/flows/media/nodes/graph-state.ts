import type { CompanyLiveContentBrief, CompanyLiveNodeTrace, GeneratedMediaBundle } from '@agent/core';
import type { MediaAsset } from '@agent/core';

export interface CompanyLiveGraphState {
  brief: CompanyLiveContentBrief;
  audioAsset: MediaAsset | null;
  imageAsset: MediaAsset | null;
  videoAsset: MediaAsset | null;
  bundle: GeneratedMediaBundle | null;
  trace: CompanyLiveNodeTrace[];
}
