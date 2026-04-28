import type { MemoryRecord } from '@agent/memory';

export function buildLearningMemoryStats(items: MemoryRecord[]) {
  const invalidated = items.filter(item => item.status === 'invalidated').length;
  const quarantinedItems = items
    .filter(item => item.quarantined)
    .sort(
      (left, right) =>
        new Date(right.quarantinedAt ?? right.lastVerifiedAt ?? right.lastUsedAt ?? right.createdAt ?? 0).getTime() -
        new Date(left.quarantinedAt ?? left.lastVerifiedAt ?? left.lastUsedAt ?? left.createdAt ?? 0).getTime()
    );

  return {
    invalidated,
    quarantined: quarantinedItems.length,
    recentQuarantined: quarantinedItems.slice(0, 8).map(item => ({
      id: item.id,
      summary: item.summary,
      quarantineReason: item.quarantineReason,
      quarantineCategory: item.quarantineCategory,
      quarantineReasonDetail: item.quarantineReasonDetail,
      quarantineRestoreSuggestion: item.quarantineRestoreSuggestion,
      quarantinedAt: item.quarantinedAt
    }))
  };
}
