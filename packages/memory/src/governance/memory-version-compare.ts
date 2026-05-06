import type { MemoryEventRecord, MemoryRecord } from '../index';

type MemoryHistoryRecord = {
  memory?: MemoryRecord;
  events: MemoryEventRecord[];
};

type MemoryCompareSnapshot = ReturnType<typeof buildMemoryCompareSnapshot>;

export function buildMemoryVersionComparison(input: {
  memoryId: string;
  history: MemoryHistoryRecord;
  leftVersion: number;
  rightVersion: number;
}) {
  const current = input.history.memory;
  if (!current) {
    return undefined;
  }

  const resolveSnapshot = (version: number): MemoryCompareSnapshot | undefined => {
    if (current.version === version) {
      return buildMemoryCompareSnapshot(current);
    }
    const event = input.history.events
      .filter(item => item.version === version)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
    const snapshot = asMemorySnapshot(event?.payload?.snapshot);
    if (!snapshot) {
      return undefined;
    }
    return buildMemoryCompareSnapshot({
      ...current,
      ...snapshot,
      id: current.id
    } as MemoryRecord);
  };

  const left = resolveSnapshot(input.leftVersion);
  const right = resolveSnapshot(input.rightVersion);
  if (!left || !right) {
    return undefined;
  }

  return {
    memoryId: input.memoryId,
    currentVersion: current.version ?? input.rightVersion,
    leftVersion: input.leftVersion,
    rightVersion: input.rightVersion,
    left,
    right,
    latestEventType: input.history.events.slice().sort((a, b) => b.version - a.version)[0]?.type
  };
}

function buildMemoryCompareSnapshot(memory: MemoryRecord) {
  return {
    summary: memory.summary,
    content: memory.content,
    status: memory.status,
    scopeType: memory.scopeType,
    memoryType: memory.memoryType,
    usageMetrics: memory.usageMetrics,
    sourceEvidenceIds: memory.sourceEvidenceIds ?? []
  };
}

function asMemorySnapshot(
  value: unknown
):
  | Partial<
      Pick<
        MemoryRecord,
        'summary' | 'content' | 'status' | 'scopeType' | 'memoryType' | 'usageMetrics' | 'sourceEvidenceIds'
      >
    >
  | undefined {
  return typeof value === 'object' && value !== null ? (value as Partial<MemoryRecord>) : undefined;
}
