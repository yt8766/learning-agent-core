import { appendFile, mkdir, readFile } from 'node:fs/promises';
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
} from '@agent/memory';
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
  normalizeMemoryRecord
} from '../normalization/memory-record-helpers';
import { FileReflectionRepository, type ReflectionRepository } from './reflection.repository';
import {
  FileResolutionCandidateRepository,
  type ResolutionCandidateRepository
} from './resolution-candidate.repository';
import { FileUserProfileRepository, type UserProfileRepository } from './user-profile.repository';
import {
  invalidateMemory,
  quarantineMemory,
  restoreMemory,
  retireMemory,
  supersedeMemory,
  type MemoryLifecycleDeps
} from './memory-repository-lifecycle';

export type {
  MemoryRepository,
  MemoryRepositoryHealthStatus,
  MemoryRepositoryMalformedLine
} from './memory-repository.types';
import type {
  MemoryRepository,
  MemoryRepositoryHealthStatus,
  MemoryRepositoryMalformedLine
} from './memory-repository.types';

export class FileMemoryRepository implements MemoryRepository {
  private readonly filePath: string;
  private vectorIndexRepository?: VectorIndexRepository;
  private readonly eventRepository: MemoryEventRepository;
  private readonly profileRepository: UserProfileRepository;
  private readonly resolutionCandidateRepository: ResolutionCandidateRepository;
  private readonly evidenceLinkRepository: MemoryEvidenceLinkRepository;
  private readonly reflectionRepository: ReflectionRepository;
  private lastHealthStatus: MemoryRepositoryHealthStatus;

  constructor(filePath = loadSettings().memoryFilePath) {
    this.filePath = resolve(filePath);
    this.lastHealthStatus = this.createHealthyStatus();
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

  getHealthStatus(): MemoryRepositoryHealthStatus {
    return {
      ...this.lastHealthStatus,
      malformedLines: [...this.lastHealthStatus.malformedLines]
    };
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
    return quarantineMemory(this.lifecycleDeps(), id, reason, evidenceRefs, category, detail, restoreSuggestion);
  }

  async invalidate(id: string, reason: string): Promise<MemoryRecord | undefined> {
    return invalidateMemory(this.lifecycleDeps(), id, reason);
  }

  async supersede(id: string, replacementId: string, reason: string): Promise<MemoryRecord | undefined> {
    return supersedeMemory(this.lifecycleDeps(), id, replacementId, reason);
  }

  async retire(id: string, reason: string): Promise<MemoryRecord | undefined> {
    return retireMemory(this.lifecycleDeps(), id, reason);
  }

  async restore(id: string): Promise<MemoryRecord | undefined> {
    return restoreMemory(this.lifecycleDeps(), id);
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

  private lifecycleDeps(): MemoryLifecycleDeps {
    return {
      filePath: this.filePath,
      readAll: () => this.readAll(),
      appendEvent: (memoryId, version, type, payload) => this.appendEvent(memoryId, version, type, payload),
      vectorIndexRepository: this.vectorIndexRepository
    };
  }

  private async readAll(): Promise<MemoryRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const records: MemoryRecord[] = [];
      const malformedLines: MemoryRepositoryMalformedLine[] = [];

      raw.split('\n').forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }
        try {
          records.push(normalizeMemoryRecord(JSON.parse(trimmed) as MemoryRecord));
        } catch (error) {
          malformedLines.push({
            lineNumber: index + 1,
            reason: `JSONL line parse or normalize failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      });

      this.lastHealthStatus = {
        filePath: this.filePath,
        malformedLineCount: malformedLines.length,
        malformedLines
      };
      return records;
    } catch {
      this.lastHealthStatus = this.createHealthyStatus();
      return [];
    }
  }

  private createHealthyStatus(): MemoryRepositoryHealthStatus {
    return {
      filePath: this.filePath,
      malformedLineCount: 0,
      malformedLines: []
    };
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
