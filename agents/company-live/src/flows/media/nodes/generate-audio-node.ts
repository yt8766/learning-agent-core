import type { SpeechSynthesisRequest } from '@agent/core';
import type { MediaProviderRegistry } from '@agent/runtime';

import type { CompanyLiveGraphState } from './graph-state';

export async function generateAudioNode(
  state: CompanyLiveGraphState,
  registry: MediaProviderRegistry
): Promise<Partial<CompanyLiveGraphState>> {
  const inputSnapshot = { briefId: state.brief.briefId, audioAsset: state.audioAsset };
  const start = Date.now();

  const provider = await registry.getAudioProvider('stub');

  const request: SpeechSynthesisRequest = {
    text: state.brief.script ?? state.brief.sellingPoints.join('. '),
    voiceId: 'stub-voice-1',
    language: state.brief.language,
    useCase: 'company-live-preview'
  };

  const result = await provider.synthesizeSpeech(request);
  const audioAsset = result.asset;
  const durationMs = Date.now() - start;

  return {
    audioAsset,
    trace: [
      ...state.trace,
      {
        nodeId: 'generateAudio',
        status: 'succeeded',
        durationMs,
        inputSnapshot,
        outputSnapshot: { audioAsset: { assetId: audioAsset.assetId, kind: audioAsset.kind } }
      }
    ]
  };
}
