export { buildCompanyLiveMediaRequest } from './flows/content/company-live-content-brief';
export { executeCompanyLiveGraph } from './graphs/company-live.graph';
export { createCompanyLiveStubRegistry } from './runtime/company-live-domain-runtime';

export const companyLiveDomainDescriptor = {
  agentId: 'official.company-live',
  displayName: 'Company Live Domain',
  type: 'composite',
  orchestrates: ['audio', 'image', 'video'],
  capabilities: ['media.audio.voice-clone', 'media.image.generate', 'media.video.generate']
} as const;

export type { CompanyLiveGraphOptions } from './graphs/company-live.graph';
