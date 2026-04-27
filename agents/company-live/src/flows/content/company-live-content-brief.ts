import {
  CompanyLiveContentBriefSchema,
  CompanyLiveMediaRequestSchema,
  type CompanyLiveContentBrief,
  type CompanyLiveMediaRequest
} from '@agent/core';

export function buildCompanyLiveMediaRequest(input: CompanyLiveContentBrief): CompanyLiveMediaRequest {
  const brief = CompanyLiveContentBriefSchema.parse(input);
  return CompanyLiveMediaRequestSchema.parse({
    requestId: `${brief.briefId}-media-request`,
    sourceBriefId: brief.briefId,
    requestedAssets: {
      image: { count: 1, purpose: 'cover' },
      voiceover: { durationMs: 30000 },
      video: { durationMs: 30000, aspectRatio: '9:16' }
    },
    reviewPolicy: 'risk-and-quality',
    approvalPolicy: 'voice-clone-requires-consent',
    deliveryFormat: 'preview-bundle'
  });
}
