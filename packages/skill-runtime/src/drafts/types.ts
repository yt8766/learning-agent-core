export type SkillDraftStatus = 'draft' | 'shadow' | 'active' | 'trusted' | 'rejected' | 'retired';

export type SkillDraftRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SkillDraftSource = 'workspace-vault' | 'learning-suggestion' | 'manual' | string;

export interface SkillDraftReuseStats {
  count: number;
  lastReusedAt?: string;
  lastRunId?: string;
}

export interface SkillDraftRecord {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  triggerHints: string[];
  bodyMarkdown: string;
  requiredTools: string[];
  requiredConnectors: string[];
  sourceTaskId: string;
  source: SkillDraftSource;
  authorId?: string;
  riskLevel: SkillDraftRiskLevel;
  confidence: number;
  sourceEvidenceIds: string[];
  status: SkillDraftStatus;
  reuseStats: SkillDraftReuseStats;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  retiredBy?: string;
  retiredAt?: string;
  retireReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSkillDraftInput {
  workspaceId: string;
  title: string;
  description?: string;
  triggerHints?: string[];
  bodyMarkdown: string;
  requiredTools?: string[];
  requiredConnectors?: string[];
  sourceTaskId: string;
  source: SkillDraftSource;
  authorId?: string;
  riskLevel?: SkillDraftRiskLevel;
  confidence?: number;
  sourceEvidenceIds?: string[];
}

export interface ReviewSkillDraftInput {
  reviewerId: string;
  reason?: string;
}

export interface RecordSkillReuseInput {
  runId: string;
  reusedAt?: string;
}

export interface SkillDraftRepository {
  create(draft: SkillDraftRecord): Promise<SkillDraftRecord>;
  list(): Promise<SkillDraftRecord[]>;
  get(id: string): Promise<SkillDraftRecord | undefined>;
  update(draft: SkillDraftRecord): Promise<SkillDraftRecord>;
}
