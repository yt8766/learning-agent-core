import type { CompanyExpertConsultation, CompanyLiveGenerateResult } from '@agent/core';

import { request } from './admin-api-core';

export interface CompanyLiveGenerateBrief {
  briefId: string;
  targetPlatform: string;
  script: string;
  durationSeconds: number;
  speakerVoiceId: string;
  backgroundMusicUri?: string;
  brandKitRef?: string;
  requestedBy?: string;
}

export interface CompanyLiveExpertConsultRequest {
  question: string;
  brief: CompanyLiveGenerateBrief;
}

export async function generateCompanyLive(brief: CompanyLiveGenerateBrief): Promise<CompanyLiveGenerateResult> {
  return request<CompanyLiveGenerateResult>('/company-live/generate', {
    method: 'POST',
    body: JSON.stringify(brief)
  });
}

export async function consultCompanyLiveExperts(
  input: CompanyLiveExpertConsultRequest
): Promise<CompanyExpertConsultation> {
  return request<CompanyExpertConsultation>('/company-live/experts/consult', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
