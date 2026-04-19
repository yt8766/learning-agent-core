import type { PlatformApprovalRecord } from '@agent/core';

import { RuntimeCentersContext } from './runtime-centers.types';
import { RuntimeCentersCatalogQueryService } from './runtime-centers-catalog.query-service';
import { RuntimeCentersLearningQueryService } from './runtime-centers-learning.query-service';
import { RuntimeCentersObservabilityQueryService } from './runtime-centers-observability.query-service';
import { RuntimeCentersRuntimeQueryService } from './runtime-centers-runtime.query-service';
import type { EvalsCenterRecord, LearningCenterRecord } from './runtime-centers.records';
import type { TechBriefingCategory } from '../briefings/runtime-tech-briefing.types';
import { exportApprovalsCenter, exportEvalsCenter, exportRuntimeCenter } from '../helpers/runtime-platform-console';

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
