import type { useChatSession } from '@/hooks/use-chat-session';

type ChatExternalSource = NonNullable<
  NonNullable<ReturnType<typeof useChatSession>['checkpoint']>['externalSources']
>[number];

export function extractEvidenceEntities(source: ChatExternalSource) {
  const relatedEntities = source.detail?.relatedEntities;
  if (!Array.isArray(relatedEntities)) {
    return [];
  }
  return relatedEntities
    .map(item => {
      if (!item || typeof item !== 'object') {
        return '';
      }
      const entityType =
        typeof (item as { entityType?: unknown }).entityType === 'string'
          ? (item as { entityType: string }).entityType
          : '';
      const entityId =
        typeof (item as { entityId?: unknown }).entityId === 'string' ? (item as { entityId: string }).entityId : '';
      return entityType && entityId ? `${entityType}:${entityId}` : entityType || entityId;
    })
    .filter(Boolean);
}
