import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { SkillDraftRecord, SkillDraftRepository } from './types';

export interface FileSkillDraftRepositoryOptions {
  filePath: string;
}

function cloneDraft(draft: SkillDraftRecord): SkillDraftRecord {
  return {
    id: draft.id,
    workspaceId: draft.workspaceId,
    title: draft.title,
    description: draft.description,
    triggerHints: [...draft.triggerHints],
    bodyMarkdown: draft.bodyMarkdown,
    requiredTools: [...draft.requiredTools],
    requiredConnectors: [...draft.requiredConnectors],
    sourceTaskId: draft.sourceTaskId,
    source: draft.source,
    authorId: draft.authorId,
    riskLevel: draft.riskLevel,
    confidence: draft.confidence,
    sourceEvidenceIds: [...draft.sourceEvidenceIds],
    status: draft.status,
    reuseStats: { ...draft.reuseStats },
    approvedBy: draft.approvedBy,
    approvedAt: draft.approvedAt,
    rejectedBy: draft.rejectedBy,
    rejectedAt: draft.rejectedAt,
    rejectionReason: draft.rejectionReason,
    retiredBy: draft.retiredBy,
    retiredAt: draft.retiredAt,
    retireReason: draft.retireReason,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt
  };
}

export class InMemorySkillDraftRepository implements SkillDraftRepository {
  private readonly drafts = new Map<string, SkillDraftRecord>();

  async create(draft: SkillDraftRecord): Promise<SkillDraftRecord> {
    const nextDraft = cloneDraft(draft);
    this.drafts.set(nextDraft.id, nextDraft);
    return cloneDraft(nextDraft);
  }

  async list(): Promise<SkillDraftRecord[]> {
    return Array.from(this.drafts.values()).map(cloneDraft);
  }

  async get(id: string): Promise<SkillDraftRecord | undefined> {
    const draft = this.drafts.get(id);
    return draft ? cloneDraft(draft) : undefined;
  }

  async update(draft: SkillDraftRecord): Promise<SkillDraftRecord> {
    if (!this.drafts.has(draft.id)) {
      throw new Error(`Skill draft ${draft.id} not found`);
    }

    const nextDraft = cloneDraft(draft);
    this.drafts.set(nextDraft.id, nextDraft);
    return cloneDraft(nextDraft);
  }
}

export class FileSkillDraftRepository implements SkillDraftRepository {
  private readonly filePath: string;

  constructor(options: FileSkillDraftRepositoryOptions) {
    this.filePath = options.filePath;
  }

  async create(draft: SkillDraftRecord): Promise<SkillDraftRecord> {
    const drafts = await this.readDrafts();
    const nextDraft = cloneDraft(draft);
    await this.writeDrafts(drafts.filter(candidate => candidate.id !== nextDraft.id).concat(nextDraft));
    return cloneDraft(nextDraft);
  }

  async list(): Promise<SkillDraftRecord[]> {
    return this.readDrafts();
  }

  async get(id: string): Promise<SkillDraftRecord | undefined> {
    const drafts = await this.readDrafts();
    const draft = drafts.find(candidate => candidate.id === id);
    return draft ? cloneDraft(draft) : undefined;
  }

  async update(draft: SkillDraftRecord): Promise<SkillDraftRecord> {
    const drafts = await this.readDrafts();
    const index = drafts.findIndex(candidate => candidate.id === draft.id);
    if (index === -1) {
      throw new Error(`Skill draft ${draft.id} not found`);
    }

    const nextDraft = cloneDraft(draft);
    const nextDrafts = drafts.slice();
    nextDrafts[index] = nextDraft;
    await this.writeDrafts(nextDrafts);
    return cloneDraft(nextDraft);
  }

  private async readDrafts(): Promise<SkillDraftRecord[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(draft => cloneDraft(draft as SkillDraftRecord));
    } catch (error) {
      if (isMissingFileError(error)) {
        await this.writeDrafts([]);
        return [];
      }

      throw error;
    }
  }

  private async writeDrafts(drafts: SkillDraftRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(drafts.map(cloneDraft), null, 2)}\n`, 'utf8');
    await rename(tempPath, this.filePath);
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ENOENT'
  );
}
