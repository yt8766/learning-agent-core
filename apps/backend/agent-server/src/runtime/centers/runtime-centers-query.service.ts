import type { IntelligenceChannel, SkillInstallReceipt, PlatformApprovalRecord } from '@agent/core';

import { buildRuntimeWorkspaceCenter } from '../core/runtime-centers-facade';
import type { RuntimeWorkspaceDraftListQuery } from './runtime-centers-workspace-drafts';
import { RuntimeCentersContext } from './runtime-centers.types';
import { RuntimeCentersCatalogQueryService } from './runtime-centers-catalog.query-service';
import { RuntimeCentersLearningQueryService } from './runtime-centers-learning.query-service';
import { RuntimeCentersObservabilityQueryService } from './runtime-centers-observability.query-service';
import { RuntimeCentersRuntimeQueryService } from './runtime-centers-runtime.query-service';
import type { EvalsCenterRecord, LearningCenterRecord, WorkspaceCenterRecord } from './runtime-centers.records';
import { getRuntimeWorkspaceDraftStoreForContext, paginateWorkspaceDrafts } from './runtime-centers-workspace-drafts';
import { attachSkillDraftInstallSummaries } from './runtime-centers-workspace-lifecycle';
import { buildRuntimeWorkspaceTaskProjection } from './runtime-centers-workspace-projection';
import {
  filterWorkspaceSkillDraftsByQuery,
  loadWorkspaceSkillReuseRecords,
  resolveWorkspaceCenterStatus,
  resolveSessionTaskIds
} from './runtime-centers-workspace-query';
import { exportApprovalsCenter, exportEvalsCenter, exportRuntimeCenter } from '../helpers/runtime-platform-console';
import { readSkillInstallReceipts } from '../skills/runtime-skill-install.service';

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
        status: resolveWorkspaceCenterStatus(taskProjection.currentTask?.status),
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
    const sessionTaskIds = resolveSessionTaskIds(ctx.orchestrator, query.sessionId);
    const filtered = filterWorkspaceSkillDraftsByQuery(workspaceCenter.skillDrafts, {
      query,
      sourceDraftIds,
      sessionTaskIds
    });

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

  async getIntelligenceOverview() {
    return this.observabilityQueryService.getIntelligenceOverview();
  }

  async forceIntelligenceRun(channel: IntelligenceChannel) {
    return this.observabilityQueryService.forceIntelligenceRun(channel);
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

async function loadSkillInstallReceipts(ctx: RuntimeCentersContext): Promise<SkillInstallReceipt[]> {
  if (!ctx.getSkillInstallContext) {
    return [];
  }

  return readSkillInstallReceipts(ctx.getSkillInstallContext());
}
