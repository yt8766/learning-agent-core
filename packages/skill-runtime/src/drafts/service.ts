import { decideSkillDraftApproval } from './policy';
import type {
  CreateSkillDraftInput,
  RecordSkillReuseInput,
  ReviewSkillDraftInput,
  SkillDraftRecord,
  SkillDraftRepository
} from './types';

export interface SkillDraftServiceOptions {
  repository: SkillDraftRepository;
  now?: () => Date;
  createId?: () => string;
}

export class SkillDraftService {
  private readonly repository: SkillDraftRepository;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: SkillDraftServiceOptions) {
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? createDefaultDraftId;
  }

  async createSkillDraft(input: CreateSkillDraftInput): Promise<SkillDraftRecord> {
    const timestamp = this.timestamp();
    const draft: SkillDraftRecord = {
      id: this.createId(),
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description,
      triggerHints: input.triggerHints ?? [],
      bodyMarkdown: input.bodyMarkdown,
      requiredTools: input.requiredTools ?? [],
      requiredConnectors: input.requiredConnectors ?? [],
      sourceTaskId: input.sourceTaskId,
      source: input.source,
      authorId: input.authorId,
      riskLevel: input.riskLevel ?? 'medium',
      confidence: input.confidence ?? 0,
      sourceEvidenceIds: input.sourceEvidenceIds ?? [],
      status: 'draft',
      reuseStats: {
        count: 0,
        lastReusedAt: undefined
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    return this.repository.create(draft);
  }

  async listSkillDrafts(): Promise<SkillDraftRecord[]> {
    return this.repository.list();
  }

  async getSkillDraft(id: string): Promise<SkillDraftRecord | undefined> {
    return this.repository.get(id);
  }

  async approveSkillDraft(id: string, input: ReviewSkillDraftInput): Promise<SkillDraftRecord> {
    const draft = await this.requireDraft(id);
    const decision = decideSkillDraftApproval(draft);
    if (!decision.allowed) {
      throw new Error(decision.reason ?? 'Skill draft cannot be approved.');
    }

    const timestamp = this.timestamp();
    return this.repository.update({
      ...draft,
      status: 'active',
      approvedBy: input.reviewerId,
      approvedAt: timestamp,
      updatedAt: timestamp
    });
  }

  async rejectSkillDraft(id: string, input: ReviewSkillDraftInput): Promise<SkillDraftRecord> {
    const draft = await this.requireDraft(id);
    const timestamp = this.timestamp();

    return this.repository.update({
      ...draft,
      status: 'rejected',
      rejectedBy: input.reviewerId,
      rejectedAt: timestamp,
      rejectionReason: input.reason,
      updatedAt: timestamp
    });
  }

  async promoteSkillDraft(id: string, input: ReviewSkillDraftInput): Promise<SkillDraftRecord> {
    const draft = await this.requireDraft(id);
    const timestamp = this.timestamp();

    return this.repository.update({
      ...draft,
      status: 'trusted',
      approvedBy: draft.approvedBy ?? input.reviewerId,
      approvedAt: draft.approvedAt ?? timestamp,
      updatedAt: timestamp
    });
  }

  async retireSkillDraft(id: string, input: ReviewSkillDraftInput): Promise<SkillDraftRecord> {
    const draft = await this.requireDraft(id);
    const timestamp = this.timestamp();

    return this.repository.update({
      ...draft,
      status: 'retired',
      retiredBy: input.reviewerId,
      retiredAt: timestamp,
      retireReason: input.reason,
      updatedAt: timestamp
    });
  }

  async recordSkillReuse(id: string, input: RecordSkillReuseInput): Promise<SkillDraftRecord> {
    const draft = await this.requireDraft(id);
    if (draft.status !== 'active' && draft.status !== 'trusted') {
      throw new Error(`Skill draft ${id} must be active or trusted before reuse can be recorded`);
    }

    const timestamp = input.reusedAt ?? this.timestamp();
    return this.repository.update({
      ...draft,
      reuseStats: {
        count: draft.reuseStats.count + 1,
        lastRunId: input.runId,
        lastReusedAt: timestamp
      },
      updatedAt: timestamp
    });
  }

  private async requireDraft(id: string): Promise<SkillDraftRecord> {
    const draft = await this.repository.get(id);
    if (!draft) {
      throw new Error(`Skill draft ${id} not found`);
    }

    return draft;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }
}

function createDefaultDraftId(): string {
  return `skill-draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
