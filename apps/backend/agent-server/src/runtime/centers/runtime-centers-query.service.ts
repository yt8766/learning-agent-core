import type { AgentSkillReuseRecord, SkillInstallReceipt, PlatformApprovalRecord } from '@agent/core';

import { buildRuntimeWorkspaceCenter } from '../core/runtime-centers-facade';
import type {
  RuntimeWorkspaceDraftListQuery,
  RuntimeWorkspaceDraftProjection
} from './runtime-centers-workspace-drafts';
import { RuntimeCentersContext } from './runtime-centers.types';
import { RuntimeCentersCatalogQueryService } from './runtime-centers-catalog.query-service';
import { RuntimeCentersLearningQueryService } from './runtime-centers-learning.query-service';
import { RuntimeCentersObservabilityQueryService } from './runtime-centers-observability.query-service';
import { RuntimeCentersRuntimeQueryService } from './runtime-centers-runtime.query-service';
import type { EvalsCenterRecord, LearningCenterRecord, WorkspaceCenterRecord } from './runtime-centers.records';
import { getRuntimeWorkspaceDraftStoreForContext, paginateWorkspaceDrafts } from './runtime-centers-workspace-drafts';
import { buildRuntimeWorkspaceTaskProjection } from './runtime-centers-workspace-projection';
import type { TechBriefingCategory } from '../briefings/runtime-tech-briefing.types';
import { exportApprovalsCenter, exportEvalsCenter, exportRuntimeCenter } from '../helpers/runtime-platform-console';
import { readSkillInstallReceipts } from '../skills/runtime-skill-install.service';

type WorkspaceDraftInstallStatus =
  | 'not_requested'
  | 'pending'
  | 'approved'
  | 'installing'
  | 'installed'
  | 'failed'
  | 'rejected';

export class RuntimeCentersQueryService {
  private readonly observabilityQueryService: RuntimeCentersObservabilityQueryService;
  private readonly runtimeQueryService: RuntimeCentersRuntimeQueryService;
  private readonly learningQueryService: RuntimeCentersLearningQueryService;
  private readonly catalogQueryService: RuntimeCentersCatalogQueryService;

  constructor(private readonly getContext: () => RuntimeCentersContext) {
    this.observabilityQueryService = new RuntimeCentersObservabilityQueryService(getContext);
    this.runtimeQueryService = new RuntimeCentersRuntimeQueryService(getContext);
    this.learningQueryService = new RuntimeCentersLearningQueryService(getContext);
    this.catalogQueryService = new RuntimeCentersCatalogQueryService(getContext);
  }

  async getRunObservatory(filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
    q?: string;
    hasInterrupt?: string;
    hasFallback?: string;
    hasRecoverableCheckpoint?: string;
    limit?: string | number;
  }) {
    return this.observabilityQueryService.getRunObservatory(filters);
  }

  async getRunObservatoryDetail(taskId: string) {
    return this.observabilityQueryService.getRunObservatoryDetail(taskId);
  }

  async getRuntimeCenter(
    days = 30,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      executionMode?: string;
      interactionKind?: string;
      metricsMode?: 'live' | 'snapshot-preferred';
    }
  ) {
    return this.runtimeQueryService.getRuntimeCenter(days, filters);
  }

  async getRuntimeCenterSummary(
    days = 30,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      executionMode?: string;
      interactionKind?: string;
    }
  ) {
    return this.runtimeQueryService.getRuntimeCenterSummary(days, filters);
  }

  async getBriefingRuns(days = 7, category?: TechBriefingCategory) {
    return this.observabilityQueryService.getBriefingRuns(days, category);
  }

  async forceBriefingRun(category: TechBriefingCategory) {
    return this.observabilityQueryService.forceBriefingRun(category);
  }

  async recordBriefingFeedback(input: {
    messageKey: string;
    category: TechBriefingCategory;
    feedbackType: 'helpful' | 'notHelpful';
    reasonTag?: 'too-noisy' | 'irrelevant' | 'too-late' | 'useful-actionable';
  }) {
    return this.observabilityQueryService.recordBriefingFeedback(input);
  }

  getApprovalsCenter(filters?: { executionMode?: string; interactionKind?: string }): PlatformApprovalRecord[] {
    return this.observabilityQueryService.getApprovalsCenter(filters);
  }

  getLearningCenter(): Promise<LearningCenterRecord> {
    return this.learningQueryService.getLearningCenter();
  }

  getLearningCenterSummary(): Promise<LearningCenterRecord> {
    return this.learningQueryService.getLearningCenterSummary();
  }

  getEvidenceCenter() {
    return this.learningQueryService.getEvidenceCenter();
  }

  async getWorkspaceCenter(): Promise<WorkspaceCenterRecord> {
    const ctx = this.getContext();
    const now = new Date().toISOString();
    const profileId = ctx.settings.profile ?? 'platform';
    const workspaceId = `workspace-${profileId}`;
    const skillDrafts = await getRuntimeWorkspaceDraftStoreForContext(ctx).listDrafts(workspaceId);
    const skillInstallReceipts = await loadSkillInstallReceipts(ctx);
    const skillDraftsWithLifecycle = attachSkillDraftInstallSummaries(skillDrafts, skillInstallReceipts);
    const skillReuseRecords = await loadWorkspaceSkillReuseRecords(ctx.runtimeStateRepository, workspaceId);
    const taskProjection = buildRuntimeWorkspaceTaskProjection(
      ctx.orchestrator?.listTasks?.() ?? [],
      skillDraftsWithLifecycle,
      skillReuseRecords
    );

    return buildRuntimeWorkspaceCenter({
      workspace: {
        workspaceId,
        sessionId: taskProjection.learningSummaries[0]?.sessionId,
        taskId: taskProjection.currentTask?.taskId,
        status: resolveWorkspaceStatus(taskProjection.currentTask?.status),
        generatedAt: now,
        updatedAt: now,
        currentTask: taskProjection.currentTask,
        evidence: taskProjection.evidence,
        reuseBadges: taskProjection.reuseBadges,
        capabilityGaps: taskProjection.capabilityGaps
      },
      reuseRecords: skillReuseRecords,
      skillDrafts: skillDraftsWithLifecycle,
      learningSummaries: taskProjection.learningSummaries
    });
  }

  async listWorkspaceSkillDrafts(query: RuntimeWorkspaceDraftListQuery = {}) {
    const ctx = this.getContext();
    const workspaceCenter = await this.getWorkspaceCenter();
    const sourceDraftIds = query.source
      ? new Set(
          (
            await getRuntimeWorkspaceDraftStoreForContext(ctx).listDrafts(workspaceCenter.workspaceId, {
              source: query.source
            })
          ).map(draft => draft.draftId)
        )
      : undefined;
    const sessionTaskIds = resolveSessionTaskIds(ctx, query.sessionId);
    const filtered = workspaceCenter.skillDrafts.filter(
      draft =>
        (!sourceDraftIds || sourceDraftIds.has(draft.draftId)) &&
        (!query.status || draft.status === query.status) &&
        (!query.sourceTaskId || draft.sourceTaskId === query.sourceTaskId) &&
        (!sessionTaskIds || (draft.sourceTaskId ? sessionTaskIds.has(draft.sourceTaskId) : false))
    );

    return paginateWorkspaceDrafts(filtered, query);
  }

  async getConnectorsCenter() {
    return this.catalogQueryService.getConnectorsCenter();
  }

  getToolsCenter() {
    return this.catalogQueryService.getToolsCenter();
  }

  async getBrowserReplay(sessionId: string) {
    return this.observabilityQueryService.getBrowserReplay(sessionId);
  }

  async getSkillSourcesCenter() {
    return this.catalogQueryService.getSkillSourcesCenter();
  }

  getCompanyAgentsCenter() {
    return this.catalogQueryService.getCompanyAgentsCenter();
  }

  async getEvalsCenter(
    days = 30,
    filters?: { scenarioId?: string; outcome?: string; metricsMode?: 'live' | 'snapshot-preferred' }
  ): Promise<EvalsCenterRecord> {
    return this.catalogQueryService.getEvalsCenter(days, filters);
  }

  async getEvalsCenterSummary(
    days = 30,
    filters?: { scenarioId?: string; outcome?: string; metricsMode?: 'live' | 'snapshot-preferred' }
  ): Promise<EvalsCenterRecord> {
    return this.catalogQueryService.getEvalsCenterSummary(days, filters);
  }

  async getPlatformConsole(
    days = 30,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      runtimeExecutionMode?: string;
      runtimeInteractionKind?: string;
      approvalsExecutionMode?: string;
      approvalsInteractionKind?: string;
    }
  ) {
    return this.observabilityQueryService.getPlatformConsole(days, filters);
  }

  async getPlatformConsoleShell(
    days = 30,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      runtimeExecutionMode?: string;
      runtimeInteractionKind?: string;
      approvalsExecutionMode?: string;
      approvalsInteractionKind?: string;
    }
  ) {
    return this.observabilityQueryService.getPlatformConsoleShell(days, filters);
  }

  async getPlatformConsoleLogAnalysis(days = 7) {
    return this.observabilityQueryService.getPlatformConsoleLogAnalysis(days);
  }

  async exportRuntimeCenter(options?: {
    days?: number;
    status?: string;
    model?: string;
    pricingSource?: string;
    executionMode?: string;
    interactionKind?: string;
    format?: string;
  }) {
    return exportRuntimeCenter(this, options);
  }

  async exportApprovalsCenter(options?: { executionMode?: string; interactionKind?: string; format?: string }) {
    return exportApprovalsCenter(this, options);
  }

  async exportEvalsCenter(options?: { days?: number; scenarioId?: string; outcome?: string; format?: string }) {
    return exportEvalsCenter(this, options);
  }
}

async function loadWorkspaceSkillReuseRecords(
  runtimeStateRepository: RuntimeCentersContext['runtimeStateRepository'] | undefined,
  workspaceId: string
): Promise<AgentSkillReuseRecord[]> {
  if (!runtimeStateRepository) {
    return [];
  }

  const snapshot = await runtimeStateRepository.load();
  return (snapshot.workspaceSkillReuseRecords ?? [])
    .filter(record => record.workspaceId === workspaceId)
    .sort((left, right) => Date.parse(right.reusedAt) - Date.parse(left.reusedAt));
}

function resolveSessionTaskIds(ctx: RuntimeCentersContext, sessionId: string | undefined): Set<string> | undefined {
  if (!sessionId) {
    return undefined;
  }

  const tasks = ctx.orchestrator?.listTasks?.() ?? [];
  return new Set(
    tasks
      .filter(task => task.sessionId === sessionId)
      .map(task => task.id)
      .filter((taskId): taskId is string => typeof taskId === 'string' && taskId.length > 0)
  );
}

async function loadSkillInstallReceipts(ctx: RuntimeCentersContext): Promise<SkillInstallReceipt[]> {
  if (!ctx.getSkillInstallContext) {
    return [];
  }

  return readSkillInstallReceipts(ctx.getSkillInstallContext());
}

function attachSkillDraftInstallSummaries(
  skillDrafts: RuntimeWorkspaceDraftProjection[],
  receipts: SkillInstallReceipt[]
): RuntimeWorkspaceDraftProjection[] {
  return skillDrafts.map(draft => {
    const receipt = findWorkspaceDraftReceipt(draft.draftId, receipts);
    const install = receipt
      ? {
          receiptId: receipt.id,
          skillId: receipt.skillId,
          sourceId: receipt.sourceId,
          version: receipt.version,
          status: normalizeInstallStatus(receipt),
          phase: normalizeInstallPhase(receipt.phase),
          installedAt: receipt.installedAt,
          failureCode: receipt.failureCode
        }
      : undefined;

    return {
      ...draft,
      install,
      provenance: {
        sourceKind: 'workspace-draft',
        sourceTaskId: draft.sourceTaskId,
        sourceEvidenceIds: draft.provenance?.sourceEvidenceIds,
        manifestId: receipt?.skillId ?? `workspace-draft-${draft.draftId}`,
        manifestSourceId: 'workspace-skill-drafts'
      },
      lifecycle: {
        draftStatus: draft.status,
        installStatus: receipt?.status,
        reusable: receipt?.status === 'installed',
        nextAction: resolveDraftNextAction(draft.status, receipt)
      }
    };
  });
}

function findWorkspaceDraftReceipt(draftId: string, receipts: SkillInstallReceipt[]): SkillInstallReceipt | undefined {
  const expectedSkillId = `workspace-draft-${draftId}`;
  return receipts
    .filter(
      receipt =>
        receipt.sourceId === 'workspace-skill-drafts' &&
        (receipt.sourceDraftId === draftId || receipt.skillId === expectedSkillId)
    )
    .sort((left, right) => (right.installedAt ?? '').localeCompare(left.installedAt ?? ''))[0];
}

function normalizeInstallStatus(receipt: SkillInstallReceipt): WorkspaceDraftInstallStatus {
  if (receipt.status === 'pending' || receipt.status === 'approved' || receipt.status === 'installed') {
    return receipt.status;
  }
  if (receipt.status === 'failed' || receipt.status === 'rejected') {
    return receipt.status;
  }
  if (receipt.phase === 'downloading' || receipt.phase === 'verifying' || receipt.phase === 'installing') {
    return 'installing';
  }
  return 'not_requested';
}

function normalizeInstallPhase(phase: SkillInstallReceipt['phase']) {
  if (
    phase === 'requested' ||
    phase === 'approved' ||
    phase === 'downloading' ||
    phase === 'verifying' ||
    phase === 'installing' ||
    phase === 'installed' ||
    phase === 'failed'
  ) {
    return phase;
  }
  return undefined;
}

function resolveDraftNextAction(draftStatus: RuntimeWorkspaceDraftProjection['status'], receipt?: SkillInstallReceipt) {
  if (receipt?.status === 'installed') {
    return 'ready_to_reuse';
  }
  if (receipt?.status === 'failed') {
    return 'retry_install';
  }
  if (receipt?.status === 'pending') {
    return 'approve_install';
  }
  if (draftStatus === 'active' || draftStatus === 'trusted') {
    return 'install_from_skill_lab';
  }
  if (draftStatus === 'draft' || draftStatus === 'shadow') {
    return 'review_draft';
  }
  return 'none';
}

function resolveWorkspaceStatus(
  status?: string
): 'idle' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'canceled' {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'waiting_approval') {
    return 'waiting_approval';
  }
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'canceled';
  }

  return 'idle';
}
