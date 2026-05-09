import {
  FileSkillDraftRepository,
  InMemorySkillDraftRepository,
  SkillDraftService,
  buildSkillDraftInstallCandidate,
  type CreateSkillDraftInput,
  type ReviewSkillDraftInput,
  type SkillDraftInstallCandidate,
  type SkillDraftRecord,
  type SkillDraftRepository
} from '@agent/skill';
import { Buffer } from 'node:buffer';
import { join } from 'node:path';

import type { WorkspaceCenterRecord } from './runtime-centers.records';

export type RuntimeWorkspaceDraftProjection = WorkspaceCenterRecord['skillDrafts'][number];

export interface RuntimeWorkspaceDraftListQuery {
  status?: string;
  source?: string;
  sourceTaskId?: string;
  sessionId?: string;
  limit?: string | number;
  cursor?: string;
}

export interface RuntimeWorkspaceDraftStoreOptions {
  repository?: SkillDraftRepository;
  filePath?: string;
  now?: () => Date;
  createId?: () => string;
}

export interface RuntimeWorkspaceDraftStore {
  seedDraft(input: CreateSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection>;
  listDrafts(workspaceId?: string, query?: RuntimeWorkspaceDraftListQuery): Promise<RuntimeWorkspaceDraftProjection[]>;
  listDraftRecords(workspaceId?: string, query?: RuntimeWorkspaceDraftListQuery): Promise<SkillDraftRecord[]>;
  approveDraft(id: string, input: ReviewSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection>;
  approveDraftForInstallCandidate(
    id: string,
    input: ReviewSkillDraftInput
  ): Promise<RuntimeWorkspaceSkillDraftApproval>;
  rejectDraft(id: string, input: ReviewSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection>;
}

export interface RuntimeWorkspaceSkillDraftApproval {
  draft: RuntimeWorkspaceDraftProjection;
  intake: {
    mode: 'install-candidate';
    status: 'ready';
    candidate: SkillDraftInstallCandidate;
  };
}

export interface RuntimeWorkspaceDraftStoreContext {
  workspaceDraftStore?: RuntimeWorkspaceDraftStore;
  settings?: {
    workspaceRoot?: string;
    skillsRoot?: string;
  };
}

class RuntimeWorkspaceDraftStoreImpl implements RuntimeWorkspaceDraftStore {
  private readonly service: SkillDraftService;

  constructor(options: RuntimeWorkspaceDraftStoreOptions = {}) {
    this.service = new SkillDraftService({
      repository:
        options.repository ??
        (options.filePath
          ? new FileSkillDraftRepository({ filePath: options.filePath })
          : new InMemorySkillDraftRepository()),
      now: options.now,
      createId: options.createId
    });
  }

  async seedDraft(input: CreateSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection> {
    return mapSkillDraftToWorkspaceProjection(await this.service.createSkillDraft(input));
  }

  async listDrafts(
    workspaceId?: string,
    query: RuntimeWorkspaceDraftListQuery = {}
  ): Promise<RuntimeWorkspaceDraftProjection[]> {
    return (await this.listDraftRecords(workspaceId, query)).map(mapSkillDraftToWorkspaceProjection);
  }

  async listDraftRecords(
    workspaceId?: string,
    query: RuntimeWorkspaceDraftListQuery = {}
  ): Promise<SkillDraftRecord[]> {
    const drafts = await this.service.listSkillDrafts();
    return paginateDrafts(
      drafts.filter(
        draft =>
          (!workspaceId || draft.workspaceId === workspaceId) &&
          (!query.status || draft.status === query.status) &&
          (!query.source || draft.source === query.source) &&
          (!query.sourceTaskId || draft.sourceTaskId === query.sourceTaskId)
      ),
      query
    );
  }

  async approveDraft(id: string, input: ReviewSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection> {
    return mapSkillDraftToWorkspaceProjection(await this.service.approveSkillDraft(id, input));
  }

  async approveDraftForInstallCandidate(
    id: string,
    input: ReviewSkillDraftInput
  ): Promise<RuntimeWorkspaceSkillDraftApproval> {
    const draft = await this.service.approveSkillDraft(id, input);
    return {
      draft: mapSkillDraftToWorkspaceProjection(draft),
      intake: {
        mode: 'install-candidate',
        status: 'ready',
        candidate: buildSkillDraftInstallCandidate(draft)
      }
    };
  }

  async rejectDraft(id: string, input: ReviewSkillDraftInput): Promise<RuntimeWorkspaceDraftProjection> {
    return mapSkillDraftToWorkspaceProjection(await this.service.rejectSkillDraft(id, input));
  }
}

let runtimeWorkspaceDraftStore: RuntimeWorkspaceDraftStore | undefined;
const runtimeWorkspaceDraftStoresByFilePath = new Map<string, RuntimeWorkspaceDraftStore>();

export function createRuntimeWorkspaceDraftStore(
  options: RuntimeWorkspaceDraftStoreOptions = {}
): RuntimeWorkspaceDraftStore {
  return new RuntimeWorkspaceDraftStoreImpl(options);
}

export function getRuntimeWorkspaceDraftStore(): RuntimeWorkspaceDraftStore {
  runtimeWorkspaceDraftStore ??= createRuntimeWorkspaceDraftStore();
  return runtimeWorkspaceDraftStore;
}

export function getRuntimeWorkspaceDraftStoreForContext(
  ctx: RuntimeWorkspaceDraftStoreContext
): RuntimeWorkspaceDraftStore {
  if (ctx.workspaceDraftStore) {
    return ctx.workspaceDraftStore;
  }

  const filePath = resolveRuntimeWorkspaceDraftFilePath(ctx);
  if (!filePath) {
    return getRuntimeWorkspaceDraftStore();
  }

  let store = runtimeWorkspaceDraftStoresByFilePath.get(filePath);
  if (!store) {
    store = createRuntimeWorkspaceDraftStore({ filePath });
    runtimeWorkspaceDraftStoresByFilePath.set(filePath, store);
  }

  return store;
}

export function resetRuntimeWorkspaceDraftStore(): void {
  runtimeWorkspaceDraftStore = undefined;
  runtimeWorkspaceDraftStoresByFilePath.clear();
}

export function mapSkillDraftToWorkspaceProjection(draft: SkillDraftRecord): RuntimeWorkspaceDraftProjection {
  const sourceEvidenceIds = draft.sourceEvidenceIds.length > 0 ? [...draft.sourceEvidenceIds] : undefined;

  return compactProjection({
    draftId: draft.id,
    status: draft.status,
    title: draft.title,
    summary: draft.description ?? draft.title,
    sourceTaskId: draft.sourceTaskId,
    confidence: draft.confidence,
    riskLevel: draft.riskLevel,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    decidedAt: draft.approvedAt ?? draft.rejectedAt ?? draft.retiredAt,
    decidedBy: draft.approvedBy ?? draft.rejectedBy ?? draft.retiredBy,
    provenance:
      sourceEvidenceIds || draft.sourceTaskId
        ? {
            sourceKind: 'workspace-draft',
            sourceTaskId: draft.sourceTaskId,
            sourceEvidenceIds
          }
        : undefined
  });
}

function compactProjection<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T;
}

export function paginateWorkspaceDrafts<T>(drafts: T[], query: RuntimeWorkspaceDraftListQuery = {}): T[] {
  return paginateDrafts(drafts, query);
}

function paginateDrafts<T>(drafts: T[], query: RuntimeWorkspaceDraftListQuery): T[] {
  const offset = decodeCursorOffset(query.cursor);
  const limit = normalizeLimit(query.limit);
  const sliced = offset > 0 ? drafts.slice(offset) : drafts;
  return limit === undefined ? sliced : sliced.slice(0, limit);
}

function normalizeLimit(limit: RuntimeWorkspaceDraftListQuery['limit']): number | undefined {
  if (limit === undefined || limit === '') {
    return undefined;
  }

  const parsed = typeof limit === 'number' ? limit : Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.min(Math.floor(parsed), 100);
}

function decodeCursorOffset(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const decoded = Buffer.from(cursor, 'base64').toString('utf8');
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resolveRuntimeWorkspaceDraftFilePath(ctx: RuntimeWorkspaceDraftStoreContext): string | undefined {
  const skillsRoot =
    ctx.settings?.skillsRoot ??
    (ctx.settings?.workspaceRoot
      ? join(ctx.settings.workspaceRoot, 'profile-storage', 'platform', 'skills')
      : undefined);
  if (!skillsRoot) {
    return undefined;
  }

  return join(skillsRoot, 'drafts', 'workspace-drafts.json');
}
