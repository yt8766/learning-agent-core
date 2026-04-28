export { assertImageGenerationRequestAllowed } from './flows/image-generation/image-generation-policy';
export { createImageDomainRuntime } from './runtime/image-domain-runtime';
export type { ImageDomainRuntime } from './runtime/image-domain-runtime';

export const imageDomainDescriptor = {
  agentId: 'official.image',
  displayName: 'Image Domain',
  capabilities: ['media.image.generate', 'media.image.edit', 'media.image.review']
} as const;
