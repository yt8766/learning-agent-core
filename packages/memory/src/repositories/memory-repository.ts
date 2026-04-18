import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import {
  MemoryEventRecord,
  MemoryEvidenceLinkRecord,
  MemoryRecord,
  MemorySearchRequest,
  MemorySearchResult,
  ReflectionRecord,
  ResolutionCandidateRecord,
  UserProfileRecord
} from '@agent/core';
import type { VectorIndexRepository } from '../vector/vector-index-repository';
import { FileMemoryEventRepository, type MemoryEventRepository } from './memory-event-repository';
import { FileMemoryEvidenceLinkRepository, type MemoryEvidenceLinkRepository } from './memory-evidence-link.repository';
import { deriveMemorySiblingPath } from '../search/memory-paths';
import {
  appendMemoryEvent,
  buildMemorySnapshotPayload,
  createResolutionCandidate,
  listMemoryReflections,
  overrideMemory,
  patchMemoryProfile,
  recordMemoryFeedback,
  replaceMemoryEvidenceLinks,
  rollbackMemory,
  type MemoryFeedbackKind
} from '../governance/memory-repository-governance';
import {
  buildStructuredSearchResult,
  isTaskSummaryQuery,
  nextVersion,
  normalizeMemoryRecord
} from '../normalization/memory-record-helpers';
import { FileReflectionRepository, type ReflectionRepository } from './reflection.repository';
import {
  FileResolutionCandidateRepository,
  type ResolutionCandidateRepository
} from './resolution-candidate.repository';
import { FileUserProfileRepository, type UserProfileRepository } from './user-profile.repository';

export interface MemoryRepository {
  append(record: MemoryRecord): Promise<void>;
  list(): Promise<MemoryRecord[]>;
  search(query: string, limit: number): Promise<MemoryRecord[]>;
  searchStructured?(request: MemorySearchRequest): Promise<MemorySearchResult>;
  getById(id: string): Promise<MemoryRecord | undefined>;
  quarantine(
    id: string,
    reason: string,
    evidenceRefs?: string[],
    category?: MemoryRecord['quarantineCategory'],
    detail?: string,
    restoreSuggestion?: string
  ): Promise<MemoryRecord | undefined>;
  invalidate(id: string, reason: string): Promise<MemoryRecord | undefined>;
  supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined>;
  retire(id: string, reason: string): Promise<MemoryRecord | undefined>;
  restore(id: string): Promise<MemoryRecord | undefined>;
  listEvents?(memoryId?: string): Promise<MemoryEventRecord[]>;
  getHistory?(id: string): Promise<{ memory?: MemoryRecord; events: MemoryEventRecord[] }>;
  recordFeedback?(id: string, kind: MemoryFeedbackKind, at?: string): Promise<MemoryRecord | undefined>;
  override?(
    id: string,
    replacement: Partial<MemoryRecord> & Pick<MemoryRecord, 'summary' | 'content'>,
    reason: string,
    actor?: string
  ): Promise<{ previous?: MemoryRecord; replacement: MemoryRecord } | undefined>;
  rollback?(id: string, version: number, actor?: string): Promise<MemoryRecord | undefined>;
  getProfile?(userId: string): Promise<UserProfileRecord | undefined>;
  patchProfile?(userId: string, patch: Partial<UserProfileRecord>, actor?: string): Promise<UserProfileRecord>;
  listResolutionCandidates?(): Promise<ResolutionCandidateRecord[]>;
  resolveResolutionCandidate?(
    id: string,
    resolution: 'accepted' | 'rejected'
  ): Promise<ResolutionCandidateRecord | undefined>;
  listEvidenceLinks?(memoryId: string): Promise<MemoryEvidenceLinkRecord[]>;
  listReflections?(): Promise<ReflectionRecord[]>;
}

export class FileMemoryRepository implements MemoryRepository {
  private readonly filePath: string;
  private vectorIndexRepository?: VectorIndexRepository;
  private readonly eventRepository: MemoryEventRepository;
  private readonly profileRepository: UserProfileRepository;
  private readonly resolutionCandidateRepository: ResolutionCandidateRepository;
  private readonly evidenceLinkRepository: MemoryEvidenceLinkRepository;
  private readonly reflectionRepository: ReflectionRepository;

  constructor(filePath = loadSettings().memoryFilePath) {
    this.filePath = resolve(filePath);
    const memoryBaseName = basename(this.filePath, '.jsonl');
    this.eventRepository = new FileMemoryEventRepository(
      deriveMemorySiblingPath(this.filePath, `${memoryBaseName}.events.jsonl`)
    );
    this.profileRepository = new FileUserProfileRepository(deriveMemorySiblingPath(this.filePath, 'profiles.json'));
    this.resolutionCandidateRepository = new FileResolutionCandidateRepository(
      deriveMemorySiblingPath(this.filePath, 'resolution-candidates.json')
    );
    this.evidenceLinkRepository = new FileMemoryEvidenceLinkRepository(
      deriveMemorySiblingPath(this.filePath, 'evidence-links.json')
    );
    this.reflectionRepository = new FileReflectionRepository(
      deriveMemorySiblingPath(this.filePath, 'reflections.json')
    );
  }

  setVectorIndexRepository(repository: VectorIndexRepository) {
    this.vectorIndexRepository = repository;
  }

  async append(record: MemoryRecord): Promise<void> {
    const normalized = normalizeMemoryRecord(record);
    await mkdir(dirname(this.filePath), { recursive: true });
    const existing = await readFile(this.filePath, 'utf8').catch(() => '');
    const prefix = existing.trim().length > 0 ? '\n' : '';
    await appendFile(this.filePath, `${prefix}${JSON.stringify(normalized)}`, 'utf8');
    await this.appendEvent(normalized.id, normalized.version ?? 1, 'memory.created', {
      summary: normalized.summary,
      status: normalized.status,
      snapshot: buildMemorySnapshotPayload(normalized)
    });
    await this.replaceEvidenceLinks(normalized);
    await this.vectorIndexRepository?.upsertMemory(normalized);
  }

  async list(): Promise<MemoryRecord[]> {
    return this.readAll();
  }

  async search(query: string, limit: number): Promise<MemoryRecord[]> {
    const lowerQuery = query.toLowerCase();
    const records = await this.readAll();

    return records
      .filter(record => {
        if (record.quarantined) {
          return false;
        }
        if (record.status === 'invalidated') {
          return false;
        }
        if (record.status === 'superseded' || record.status === 'retired') {
          return false;
        }
        if (record.tags.includes('chat-session')) {
          return false;
        }
        if (record.type === 'task_summary' && !isTaskSummaryQuery(lowerQuery)) {
          return false;
        }
        const haystack = `${record.summary} ${record.content} ${record.tags.join(' ')}`.toLowerCase();
        return haystack.includes(lowerQuery);
      })
      .slice(0, limit);
  }

  async searchStructured(request: MemorySearchRequest): Promise<MemorySearchResult> {
    return buildStructuredSearchResult(await this.readAll(), request, (query, limit) =>
      this.reflectionRepository.search(query, limit)
    );
  }

  async getById(id: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    return records.find(record => record.id === id);
  }

  async quarantine(
    id: string,
    reason: string,
    evidenceRefs: string[] = [],
    category?: MemoryRecord['quarantineCategory'],
    detail?: string,
    restoreSuggestion?: string
  ): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
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
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.appendEvent(target.id, target.version ?? 1, 'memory.status_changed', {
      status: 'quarantined',
      reason,
      snapshot: buildMemorySnapshotPayload(target)
    });
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async invalidate(id: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'invalidated';
    target.invalidatedAt = new Date().toISOString();
    target.invalidationReason = reason;
    target.version = nextVersion(target);
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.appendEvent(target.id, target.version, 'memory.status_changed', {
      status: 'invalidated',
      reason,
      snapshot: buildMemorySnapshotPayload(target)
    });
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'superseded';
    target.supersededById = replacementId;
    target.supersededAt = new Date().toISOString();
    target.invalidationReason = reason;
    target.version = nextVersion(target);
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.appendEvent(target.id, target.version, 'memory.status_changed', {
      status: 'superseded',
      reason,
      replacementId,
      snapshot: buildMemorySnapshotPayload(target)
    });
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async retire(id: string, reason: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
    if (!target) {
      return undefined;
    }

    target.status = 'retired';
    target.retiredAt = new Date().toISOString();
    target.invalidationReason = reason;
    target.version = nextVersion(target);
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.appendEvent(target.id, target.version, 'memory.archived', {
      status: 'retired',
      reason,
      snapshot: buildMemorySnapshotPayload(target)
    });
    await this.vectorIndexRepository?.remove('memory', target.id);
    return target;
  }

  async restore(id: string): Promise<MemoryRecord | undefined> {
    const records = await this.readAll();
    const target = records.find(record => record.id === id);
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
    await writeFile(this.filePath, records.map(item => JSON.stringify(item)).join('\n'));
    await this.appendEvent(target.id, target.version, 'memory.restored', {
      status: 'active',
      snapshot: buildMemorySnapshotPayload(target)
    });
    await this.vectorIndexRepository?.upsertMemory(target);
    return target;
  }

  async listEvents(memoryId?: string): Promise<MemoryEventRecord[]> {
    return this.eventRepository.list(memoryId);
  }

  async getHistory(id: string): Promise<{ memory?: MemoryRecord; events: MemoryEventRecord[] }> {
    const [memory, events] = await Promise.all([this.getById(id), this.listEvents(id)]);
    return { memory, events };
  }

  async recordFeedback(
    id: string,
    kind: MemoryFeedbackKind,
    at = new Date().toISOString()
  ): Promise<MemoryRecord | undefined> {
    return recordMemoryFeedback({
      filePath: this.filePath,
      readAll: () => this.readAll(),
      appendEvent: (memoryId, version, type, payload) => this.appendEvent(memoryId, version, type, payload),
      upsertMemory: record => this.vectorIndexRepository?.upsertMemory(record) ?? Promise.resolve(),
      id,
      kind,
      at
    });
  }

  async override(
    id: string,
    replacement: Partial<MemoryRecord> & Pick<MemoryRecord, 'summary' | 'content'>,
    reason: string,
    actor = 'system'
  ): Promise<{ previous?: MemoryRecord; replacement: MemoryRecord } | undefined> {
    return overrideMemory({
      getById: memoryId => this.getById(memoryId),
      recordFeedback: (memoryId, kind, correctedAt) => this.recordFeedback(memoryId, kind, correctedAt),
      append: record => this.append(record),
      appendEvent: (memoryId, version, type, payload) => this.appendEvent(memoryId, version, type, payload),
      createResolutionCandidate: (previous, nextRecord, resolutionReason) =>
        this.createResolutionCandidate(previous, nextRecord, resolutionReason),
      id,
      replacement,
      reason,
      actor
    });
  }

  async rollback(id: string, version: number, actor = 'system'): Promise<MemoryRecord | undefined> {
    return rollbackMemory({
      filePath: this.filePath,
      getHistory: memoryId => this.getHistory(memoryId),
      readAll: () => this.readAll(),
      appendEvent: (memoryId, eventVersion, type, payload) => this.appendEvent(memoryId, eventVersion, type, payload),
      upsertMemory: record => this.vectorIndexRepository?.upsertMemory(record) ?? Promise.resolve(),
      id,
      version,
      actor
    });
  }

  async getProfile(userId: string): Promise<UserProfileRecord | undefined> {
    return this.profileRepository.getById(userId);
  }

  async patchProfile(userId: string, patch: Partial<UserProfileRecord>, actor = 'system'): Promise<UserProfileRecord> {
    return patchMemoryProfile(
      this.profileRepository,
      (memoryId, version, type, payload) => this.appendEvent(memoryId, version, type, payload),
      userId,
      patch,
      actor
    );
  }

  async listResolutionCandidates(): Promise<ResolutionCandidateRecord[]> {
    return this.resolutionCandidateRepository.list();
  }

  async resolveResolutionCandidate(
    id: string,
    resolution: 'accepted' | 'rejected'
  ): Promise<ResolutionCandidateRecord | undefined> {
    return this.resolutionCandidateRepository.resolve(id, resolution, new Date().toISOString());
  }

  async listEvidenceLinks(memoryId: string): Promise<MemoryEvidenceLinkRecord[]> {
    return this.evidenceLinkRepository.listByMemoryId(memoryId);
  }

  async listReflections(): Promise<ReflectionRecord[]> {
    return listMemoryReflections(this.reflectionRepository);
  }

  private async readAll(): Promise<MemoryRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return raw
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .flatMap(line => {
          try {
            return [normalizeMemoryRecord(JSON.parse(line) as MemoryRecord)];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  }

  private async appendEvent(
    memoryId: string,
    version: number,
    type: MemoryEventRecord['type'],
    payload: Record<string, unknown>
  ) {
    await appendMemoryEvent(this.eventRepository, memoryId, version, type, payload);
  }

  private async replaceEvidenceLinks(record: MemoryRecord) {
    await replaceMemoryEvidenceLinks(this.evidenceLinkRepository, record);
  }

  private async createResolutionCandidate(previous: MemoryRecord, replacement: MemoryRecord, reason: string) {
    await createResolutionCandidate(this.resolutionCandidateRepository, previous, replacement, reason);
  }
}
