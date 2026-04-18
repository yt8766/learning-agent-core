import { writeFile } from 'node:fs/promises';

import {
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemoryRecord,
  ResolutionCandidateRecord,
  UserProfileRecord
} from '@agent/core';

import type { MemoryEventRepository } from './repositories/memory-event-repository';
import type { MemoryEvidenceLinkRepository } from './repositories/memory-evidence-link.repository';
import { normalizeMemoryRecord, nextVersion } from './memory-record-helpers';
import type { ReflectionRepository } from './repositories/reflection.repository';
import type { ResolutionCandidateRepository } from './repositories/resolution-candidate.repository';
import type { UserProfileRepository } from './repositories/user-profile.repository';

export type MemoryFeedbackKind = 'retrieved' | 'injected' | 'adopted' | 'dismissed' | 'corrected';

export function buildMemorySnapshotPayload(record: MemoryRecord) {
  return {
    id: record.id,
    summary: record.summary,
    content: record.content,
    status: record.status,
    scopeType: record.scopeType,
    memoryType: record.memoryType,
    sourceEvidenceIds: record.sourceEvidenceIds,
    usageMetrics: record.usageMetrics,
    version: record.version
  };
}

export async function appendMemoryEvent(
  eventRepository: MemoryEventRepository,
  memoryId: string,
  version: number,
  type: MemoryEventRecord['type'],
  payload: Record<string, unknown>
) {
  await eventRepository.append({
    id: `${memoryId}:${version}:${type}`,
    memoryId,
    version,
    type,
    payload,
    createdAt: new Date().toISOString()
  });
}

export async function replaceMemoryEvidenceLinks(
  evidenceLinkRepository: MemoryEvidenceLinkRepository,
  record: MemoryRecord
) {
  const links = (record.sourceEvidenceIds ?? []).map<MemoryEvidenceLinkRecord>((evidenceId, index) => ({
    id: `${record.id}:evidence:${index + 1}`,
    memoryId: record.id,
    evidenceId,
    createdAt: record.createdAt
  }));
  await evidenceLinkRepository.replaceForMemory(record.id, links);
}

export async function createResolutionCandidate(
  resolutionCandidateRepository: ResolutionCandidateRepository,
  previous: MemoryRecord,
  replacement: MemoryRecord,
  reason: string
) {
  await resolutionCandidateRepository.append({
    id: `${previous.id}:resolution:${Date.now()}`,
    conflictKind: 'override_conflict',
    challengerId: replacement.id,
    incumbentId: previous.id,
    suggestedAction: 'supersede_existing',
    confidence: 0.95,
    rationale: reason,
    requiresHumanReview: false,
    createdAt: new Date().toISOString(),
    resolution: 'pending'
  });
}

export async function recordMemoryFeedback(params: {
  filePath: string;
  readAll: () => Promise<MemoryRecord[]>;
  appendEvent: (
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ) => Promise<void>;
  upsertMemory: (record: MemoryRecord) => Promise<void>;
  id: string;
  kind: MemoryFeedbackKind;
  at: string;
}) {
  const records = await params.readAll();
  const target = records.find(record => record.id === params.id);
  if (!target) {
    return undefined;
  }

  const metrics = {
    retrievedCount: target.usageMetrics?.retrievedCount ?? 0,
    injectedCount: target.usageMetrics?.injectedCount ?? 0,
    adoptedCount: target.usageMetrics?.adoptedCount ?? 0,
    dismissedCount: target.usageMetrics?.dismissedCount ?? 0,
    correctedCount: target.usageMetrics?.correctedCount ?? 0,
    lastRetrievedAt: target.usageMetrics?.lastRetrievedAt,
    lastAdoptedAt: target.usageMetrics?.lastAdoptedAt,
    lastDismissedAt: target.usageMetrics?.lastDismissedAt,
    lastCorrectedAt: target.usageMetrics?.lastCorrectedAt
  };

  if (params.kind === 'retrieved') {
    metrics.retrievedCount += 1;
    metrics.lastRetrievedAt = params.at;
  } else if (params.kind === 'injected') {
    metrics.injectedCount += 1;
    metrics.lastRetrievedAt = params.at;
  } else if (params.kind === 'adopted') {
    metrics.adoptedCount += 1;
    metrics.lastAdoptedAt = params.at;
  } else if (params.kind === 'dismissed') {
    metrics.dismissedCount += 1;
    metrics.lastDismissedAt = params.at;
  } else if (params.kind === 'corrected') {
    metrics.correctedCount += 1;
    metrics.lastCorrectedAt = params.at;
    target.status = 'disputed';
  }

  target.lastUsedAt = params.at;
  target.usageMetrics = metrics;
  target.version = nextVersion(target);
  await writeFile(params.filePath, records.map(item => JSON.stringify(item)).join('\n'));
  await params.appendEvent(target.id, target.version, 'memory.metrics_recorded', {
    kind: params.kind,
    metrics,
    snapshot: buildMemorySnapshotPayload(target)
  });
  await params.upsertMemory(target);
  return target;
}

export async function overrideMemory(params: {
  getById: (id: string) => Promise<MemoryRecord | undefined>;
  recordFeedback: (id: string, kind: MemoryFeedbackKind, at?: string) => Promise<MemoryRecord | undefined>;
  append: (record: MemoryRecord) => Promise<void>;
  appendEvent: (
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ) => Promise<void>;
  createResolutionCandidate: (previous: MemoryRecord, replacement: MemoryRecord, reason: string) => Promise<void>;
  id: string;
  replacement: Partial<MemoryRecord> & Pick<MemoryRecord, 'summary' | 'content'>;
  reason: string;
  actor: string;
}) {
  const previous = await params.getById(params.id);
  if (!previous) {
    return undefined;
  }
  const corrected = await params.recordFeedback(params.id, 'corrected');
  const now = new Date().toISOString();
  const nextRecord = normalizeMemoryRecord({
    ...previous,
    ...params.replacement,
    id: params.replacement.id ?? `${params.id}:override:${Date.now()}`,
    overrideFor: params.id,
    supersededById: undefined,
    status: 'active',
    version: 1,
    createdAt: params.replacement.createdAt ?? now
  });
  await params.append(nextRecord);
  await params.appendEvent(nextRecord.id, nextRecord.version ?? 1, 'memory.override_applied', {
    actor: params.actor,
    overrideFor: params.id,
    reason: params.reason,
    snapshot: buildMemorySnapshotPayload(nextRecord)
  });
  await params.createResolutionCandidate(corrected ?? previous, nextRecord, params.reason);
  return { previous: corrected ?? previous, replacement: nextRecord };
}

export async function rollbackMemory(params: {
  filePath: string;
  getHistory: (id: string) => Promise<{ memory?: MemoryRecord; events: MemoryEventRecord[] }>;
  readAll: () => Promise<MemoryRecord[]>;
  appendEvent: (
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ) => Promise<void>;
  upsertMemory: (record: MemoryRecord) => Promise<void>;
  id: string;
  version: number;
  actor: string;
}) {
  const history = await params.getHistory(params.id);
  const targetEvent = history.events
    .filter(event => event.version <= params.version)
    .sort((left, right) => right.version - left.version)[0];
  const current = history.memory;
  if (!targetEvent || !current) {
    return undefined;
  }

  const records = await params.readAll();
  const target = records.find(record => record.id === params.id);
  if (!target) {
    return undefined;
  }

  const payload = targetEvent.payload as Partial<MemoryRecord>;
  const rolledBack = normalizeMemoryRecord({
    ...target,
    ...payload,
    id: target.id,
    version: nextVersion(target),
    restoredAt: new Date().toISOString()
  });

  const index = records.findIndex(record => record.id === params.id);
  records[index] = rolledBack;
  await writeFile(params.filePath, records.map(item => JSON.stringify(item)).join('\n'));
  await params.appendEvent(params.id, rolledBack.version ?? 1, 'memory.rollback_applied', {
    actor: params.actor,
    targetVersion: params.version,
    snapshot: buildMemorySnapshotPayload(rolledBack)
  });
  await params.upsertMemory(rolledBack);
  return rolledBack;
}

export async function patchMemoryProfile(
  profileRepository: UserProfileRepository,
  appendEvent: (
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ) => Promise<void>,
  userId: string,
  patch: Partial<UserProfileRecord>,
  actor: string
) {
  const now = new Date().toISOString();
  const next = await profileRepository.patch(userId, { ...patch, updatedAt: now });
  await appendEvent(`profile:${userId}`, 1, 'memory.updated', {
    actor,
    profile: next
  });
  return next;
}

export async function listMemoryReflections(reflectionRepository: ReflectionRepository) {
  return reflectionRepository.list();
}
