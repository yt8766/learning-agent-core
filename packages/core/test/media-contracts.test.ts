import { describe, expect, it } from 'vitest';
import {
  CompanyLiveContentBriefSchema,
  CompanyLiveGenerateResultSchema,
  CompanyLiveMediaRequestSchema,
  CompanyLiveNodeTraceSchema,
  MediaAssetSchema,
  MediaGenerationTaskSchema,
  SpeechSynthesisRequestSchema,
  VoiceCloneRequestSchema
} from '../src';

describe('@agent/core media contracts', () => {
  it('parses a generated audio asset and completed media task', () => {
    const asset = MediaAssetSchema.parse({
      assetId: 'asset-audio-1',
      kind: 'audio',
      uri: 'memory://assets/audio-1.mp3',
      mimeType: 'audio/mpeg',
      durationMs: 30000,
      provider: 'minimax',
      model: 'speech-2.8-hd',
      provenance: {
        source: 'generated',
        promptRef: 'prompt-1',
        evidenceRefs: ['ev-1']
      },
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(asset.kind).toBe('audio');

    const task = MediaGenerationTaskSchema.parse({
      taskId: 'media-task-1',
      kind: 'audio',
      provider: 'minimax',
      status: 'succeeded',
      providerTaskId: 'provider-task-1',
      assetRefs: ['asset-audio-1'],
      evidenceRefs: ['ev-1'],
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:01.000Z',
      completedAt: '2026-04-27T00:00:01.000Z'
    });

    expect(task.status).toBe('succeeded');
  });

  it('requires voice clone consent evidence before provider execution', () => {
    expect(() =>
      VoiceCloneRequestSchema.parse({
        sourceAudioAssetId: 'asset-source-1',
        requestedVoiceId: 'host-us-voice',
        voiceOwner: 'Host A',
        intendedUse: 'Generate authorized livestream preview voiceover.',
        allowedScopes: ['company-live-preview'],
        riskContext: { riskLevel: 'high', reason: 'voice_clone' }
      })
    ).toThrow();

    const request = VoiceCloneRequestSchema.parse({
      sourceAudioAssetId: 'asset-source-1',
      requestedVoiceId: 'host-us-voice',
      voiceOwner: 'Host A',
      consentEvidenceRef: 'ev-consent-1',
      intendedUse: 'Generate authorized livestream preview voiceover.',
      allowedScopes: ['company-live-preview'],
      riskContext: { riskLevel: 'high', reason: 'voice_clone' }
    });

    expect(request.consentEvidenceRef).toBe('ev-consent-1');
  });

  it('parses speech synthesis requests without MiniMax-only fields', () => {
    const request = SpeechSynthesisRequestSchema.parse({
      text: 'Launch week starts now.',
      language: 'en-US',
      voiceId: 'Chinese (Mandarin)_Gentleman',
      useCase: 'company-live-preview',
      qualityPreference: 'quality',
      latencyPreference: 'balanced'
    });

    expect(request.text).toContain('Launch');
  });

  it('parses CompanyLive content brief and requested media bundle', () => {
    const brief = CompanyLiveContentBriefSchema.parse({
      briefId: 'brief-1',
      targetPlatform: 'TikTok',
      targetRegion: 'US',
      language: 'en-US',
      audienceProfile: 'US shoppers interested in skincare bundles.',
      productRefs: ['sku-1'],
      sellingPoints: ['Fast visible glow', 'Bundle discount'],
      offer: '20% launch discount',
      script: 'Open with the result, then show the bundle.',
      visualBrief: 'Vertical cover with product bundle and bright studio light.',
      voiceBrief: 'Energetic English voiceover.',
      videoBrief: '30 second vertical preview video.',
      complianceNotes: ['Avoid medical claims.'],
      riskLevel: 'medium',
      evidenceRefs: ['ev-product-1'],
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(brief.targetRegion).toBe('US');

    const request = CompanyLiveMediaRequestSchema.parse({
      requestId: 'media-request-1',
      sourceBriefId: 'brief-1',
      requestedAssets: {
        image: { count: 1, purpose: 'cover' },
        voiceover: { durationMs: 30000 },
        video: { durationMs: 30000, aspectRatio: '9:16' }
      },
      reviewPolicy: 'risk-and-quality',
      approvalPolicy: 'voice-clone-requires-consent',
      deliveryFormat: 'preview-bundle'
    });

    expect(request.requestedAssets.video?.aspectRatio).toBe('9:16');
  });

  it('parses a CompanyLiveNodeTrace', () => {
    const trace = CompanyLiveNodeTraceSchema.parse({
      nodeId: 'generateAudio',
      status: 'succeeded',
      durationMs: 12,
      inputSnapshot: { audioAssetRef: null },
      outputSnapshot: { audioAssetRef: 'asset-audio-stub-1' }
    });

    expect(trace.nodeId).toBe('generateAudio');
    expect(trace.status).toBe('succeeded');
    expect(trace.durationMs).toBe(12);
    expect(trace.outputSnapshot['audioAssetRef']).toBe('asset-audio-stub-1');
  });

  it('parses a CompanyLiveGenerateResult with bundle and trace', () => {
    const result = CompanyLiveGenerateResultSchema.parse({
      bundle: {
        bundleId: 'bundle-stub-1',
        requestId: 'req-stub-1',
        assets: [],
        createdAt: '2026-04-29T00:00:00.000Z'
      },
      trace: [
        {
          nodeId: 'generateAudio',
          status: 'succeeded',
          durationMs: 12,
          inputSnapshot: { audioAssetRef: null },
          outputSnapshot: { audioAssetRef: 'asset-audio-stub-1' }
        },
        {
          nodeId: 'assembleBundle',
          status: 'succeeded',
          durationMs: 3,
          inputSnapshot: { assetCount: 3 },
          outputSnapshot: { bundleId: 'bundle-stub-1' }
        }
      ]
    });

    expect(result.bundle.bundleId).toBe('bundle-stub-1');
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0]?.nodeId).toBe('generateAudio');
  });

  it('rejects CompanyLiveNodeTrace with invalid status', () => {
    expect(() =>
      CompanyLiveNodeTraceSchema.parse({
        nodeId: 'generateAudio',
        status: 'unknown',
        durationMs: 12,
        inputSnapshot: {},
        outputSnapshot: {}
      })
    ).toThrow();
  });
});
