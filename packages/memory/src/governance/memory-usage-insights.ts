import type { MemoryRecord } from '@agent/memory';

export function buildMemoryUsageInsights(memories: MemoryRecord[]) {
  const totals = memories.reduce(
    (summary, memory) => {
      summary.totalMemories += 1;
      summary.retrieved += memory.usageMetrics?.retrievedCount ?? 0;
      summary.injected += memory.usageMetrics?.injectedCount ?? 0;
      summary.adopted += memory.usageMetrics?.adoptedCount ?? 0;
      summary.dismissed += memory.usageMetrics?.dismissedCount ?? 0;
      summary.corrected += memory.usageMetrics?.correctedCount ?? 0;
      const memoryType = memory.memoryType ?? 'unknown';
      summary.byMemoryType[memoryType] =
        (summary.byMemoryType[memoryType] ?? 0) + (memory.usageMetrics?.adoptedCount ?? 0);
      const status = memory.status ?? 'unknown';
      summary.byStatus[status] = (summary.byStatus[status] ?? 0) + 1;
      return summary;
    },
    {
      totalMemories: 0,
      retrieved: 0,
      injected: 0,
      adopted: 0,
      dismissed: 0,
      corrected: 0,
      byMemoryType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>
    }
  );

  const rankBy = (selector: (memory: MemoryRecord) => number) =>
    memories
      .slice()
      .sort((left, right) => selector(right) - selector(left))
      .filter(memory => selector(memory) > 0)
      .slice(0, 5)
      .map(memory => ({
        id: memory.id,
        summary: memory.summary,
        memoryType: memory.memoryType,
        status: memory.status,
        value: selector(memory)
      }));

  return {
    totalMemories: totals.totalMemories,
    totalRetrieved: totals.retrieved,
    totalInjected: totals.injected,
    totalAdopted: totals.adopted,
    totalDismissed: totals.dismissed,
    totalCorrected: totals.corrected,
    adoptionRate: totals.injected > 0 ? Number((totals.adopted / totals.injected).toFixed(4)) : 0,
    topAdoptedMemories: rankBy(memory => memory.usageMetrics?.adoptedCount ?? 0),
    topDismissedMemories: rankBy(memory => memory.usageMetrics?.dismissedCount ?? 0),
    topCorrectedMemories: rankBy(memory => memory.usageMetrics?.correctedCount ?? 0),
    adoptionByMemoryType: Object.entries(totals.byMemoryType).map(([memoryType, adoptedCount]) => ({
      memoryType,
      adoptedCount
    })),
    countByStatus: Object.entries(totals.byStatus).map(([status, count]) => ({
      status,
      count
    }))
  };
}
