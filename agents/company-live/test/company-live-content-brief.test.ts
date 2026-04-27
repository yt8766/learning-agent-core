import { describe, expect, it } from 'vitest';
import { buildCompanyLiveMediaRequest } from '../src';

describe('@agent/agents-company-live content-to-media workflow', () => {
  it('turns a CompanyLive content brief into a media request', () => {
    const request = buildCompanyLiveMediaRequest({
      briefId: 'brief-1',
      targetPlatform: 'TikTok',
      targetRegion: 'US',
      language: 'en-US',
      audienceProfile: 'US skincare shoppers.',
      productRefs: ['sku-1'],
      sellingPoints: ['Fast glow', 'Launch discount'],
      offer: '20% off',
      script: 'Show the result, then the bundle.',
      visualBrief: 'Vertical cover image with product bundle.',
      voiceBrief: 'Energetic English voiceover.',
      videoBrief: '30 second vertical preview.',
      complianceNotes: ['Avoid medical claims.'],
      riskLevel: 'medium',
      evidenceRefs: ['ev-1'],
      createdAt: '2026-04-27T00:00:00.000Z'
    });

    expect(request.sourceBriefId).toBe('brief-1');
    expect(request.requestedAssets.video?.aspectRatio).toBe('9:16');
    expect(request.reviewPolicy).toBe('risk-and-quality');
  });
});
