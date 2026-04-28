export { assertVideoGenerationRequestAllowed } from './flows/video-generation/video-generation-policy';
export { createVideoDomainRuntime } from './runtime/video-domain-runtime';
export type { VideoDomainRuntime } from './runtime/video-domain-runtime';

export const videoDomainDescriptor = {
  agentId: 'official.video',
  displayName: 'Video Domain',
  capabilities: ['media.video.generate', 'media.video.template', 'media.video.review']
} as const;
