import { writeFile } from 'node:fs/promises';

import type { MemoryEventRecord, MemoryRecord } from '@agent/core';
import type { VectorIndexRepository } from '../vector/vector-index-repository';
import { buildMemorySnapshotPayload } from '../governance/memory-repository-governance';
import { nextVersion } from '../normalization/memory-record-helpers';

export interface MemoryLifecycleDeps {
  filePath: string;
  readAll(): Promise<MemoryRecord[]>;
  appendEvent(
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ): Promise<void>;
  vectorIndexRepository?: VectorIndexRepository;
}

function findTarget(records: MemoryRecord[], id: string): MemoryRecord | undefined {
  return records.find(record => record.id === id);
}

async function persistRecords(filePath: string, records: MemoryRecord[]): Promise<void> {
  await writeFile(filePath, records.map(item => JSON.stringify(item)).join('\n'));
}

export async function quarantineMemory(
  deps: MemoryLifecycleDeps,
  id: string,
  reason: string,
  evidenceRefs: string[] = [],
  category?: MemoryRecord['quarantineCategory'],
  detail?: string,
  restoreSuggestion?: string
): Promise<MemoryRecord | undefined> {
  const records = await deps.readAll();
  const target = findTarget(records, id);
  if (!target) {
    return undefined;
  }

  target.quarantined = true;
  target.quarantineReason = reason;
  target.quarantineCategory = category;
  target.quarantineReasonDetail = detail;
  target.quarantineRestoreSuggestion = restoreSuggestion;
  target.quarantineEvidenceRefs = evidenceRefs;
  target.quarantinedAt = new Date().toISOString();
  await persistRecords(deps.filePath, records);
  await deps.appendEvent(target.id, target.version ?? 1, 'memory.status_changed', {
    status: 'quarantined',
    reason,
    snapshot: buildMemorySnapshotPayload(target)
  });
  await deps.vectorIndexRepository?.remove('memory', target.id);
  return target;
}

export async function invalidateMemory(
  deps: MemoryLifecycleDeps,
  id: string,
  reason: string
): Promise<MemoryRecord | undefined> {
  const records = await deps.readAll();
  const target = findTarget(records, id);
  if (!target) {
    return undefined;
  }

  target.status = 'invalidated';
  target.invalidatedAt = new Date().toISOString();
  target.invalidationReason = reason;
  target.version = nextVersion(target);
  await persistRecords(deps.filePath, records);
  await deps.appendEvent(target.id, target.version, 'memory.status_changed', {
    status: 'invalidated',
    reason,
    snapshot: buildMemorySnapshotPayload(target)
  });
  await deps.vectorIndexRepository?.remove('memory', target.id);
  return target;
}

export async function supersedeMemory(
  deps: MemoryLifecycleDeps,
  id: string,
  replacementId: string,
  reason: string
): Promise<MemoryRecord | undefined> {
  const records = await deps.readAll();
  const target = findTarget(records, id);
  if (!target) {
    return undefined;
  }

  target.status = 'superseded';
  target.supersededById = replacementId;
  target.supersededAt = new Date().toISOString();
  target.invalidationReason = reason;
  target.version = nextVersion(target);
  await persistRecords(deps.filePath, records);
  await deps.appendEvent(target.id, target.version, 'memory.status_changed', {
    status: 'superseded',
    reason,
    replacementId,
    snapshot: buildMemorySnapshotPayload(target)
  });
  await deps.vectorIndexRepository?.remove('memory', target.id);
  return target;
}

export async function retireMemory(
  deps: MemoryLifecycleDeps,
  id: string,
  reason: string
): Promise<MemoryRecord | undefined> {
  const records = await deps.readAll();
  const target = findTarget(records, id);
  if (!target) {
    return undefined;
  }

  target.status = 'retired';
  target.retiredAt = new Date().toISOString();
  target.invalidationReason = reason;
  target.version = nextVersion(target);
  await persistRecords(deps.filePath, records);
  await deps.appendEvent(target.id, target.version, 'memory.archived', {
    status: 'retired',
    reason,
    snapshot: buildMemorySnapshotPayload(target)
  });
  await deps.vectorIndexRepository?.remove('memory', target.id);
  return target;
}

export async function restoreMemory(deps: MemoryLifecycleDeps, id: string): Promise<MemoryRecord | undefined> {
  const records = await deps.readAll();
  const target = findTarget(records, id);
  if (!target) {
    return undefined;
  }

  target.status = 'active';
  target.restoredAt = new Date().toISOString();
  target.invalidatedAt = undefined;
  target.invalidationReason = undefined;
  target.supersededAt = undefined;
  target.supersededById = undefined;
  target.retiredAt = undefined;
  target.quarantined = false;
  target.quarantineReason = undefined;
  target.quarantineCategory = undefined;
  target.quarantineReasonDetail = undefined;
  target.quarantineRestoreSuggestion = undefined;
  target.quarantineEvidenceRefs = undefined;
  target.quarantinedAt = undefined;
  target.version = nextVersion(target);
  await persistRecords(deps.filePath, records);
  await deps.appendEvent(target.id, target.version, 'memory.restored', {
    status: 'active',
    snapshot: buildMemorySnapshotPayload(target)
  });
  await deps.vectorIndexRepository?.upsertMemory(target);
  return target;
}
