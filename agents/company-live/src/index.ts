export { buildCompanyLiveMediaRequest } from './flows/content/company-live-content-brief';
export { companyLiveCoreExpertIds, companyLiveExpertDefinitions } from './flows/company-live/expert-definitions';
export { routeCompanyLiveExperts } from './flows/company-live/nodes/expert-router-node';
export { executeCompanyLiveGraph } from './graphs/company-live.graph';
export { consultCompanyLiveExperts } from './graphs/company-live-experts.graph';
export { createCompanyLiveStubRegistry } from './runtime/company-live-domain-runtime';

export const companyLiveDomainDescriptor = {
  agentId: 'official.company-live',
  displayName: 'Company Live Domain',
  type: 'composite',
  orchestrates: ['audio', 'image', 'video'],
  capabilities: ['media.audio.voice-clone', 'media.image.generate', 'media.video.generate']
} as const;

export type { CompanyLiveGraphOptions } from './graphs/company-live.graph';
export type { CompanyLiveExpertConsultOptions } from './graphs/company-live-experts.graph';
export type { CompanyLiveExpertConsultInput } from './flows/company-live/nodes/expert-consultation-nodes';
