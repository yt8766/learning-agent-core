import type { EvidenceRecord } from '@agent/core';
import type { RuntimeStateSnapshot } from '@agent/memory';

export function applyCrossCheckEvidenceRecords(
  snapshot: RuntimeStateSnapshot,
  memoryId: string,
  records: EvidenceRecord[]
): RuntimeStateSnapshot {
  if (!records.length) {
    return snapshot;
  }

  const current = snapshot.crossCheckEvidence ?? [];
  const next = [...current];

  for (const record of records) {
    const index = next.findIndex(item => item.record.id === record.id);
    const entry = { memoryId, record };
    if (index >= 0) {
      next[index] = entry;
    } else {
      next.push(entry);
    }
  }

  return {
    ...snapshot,
    crossCheckEvidence: next.slice(-200)
  };
}
