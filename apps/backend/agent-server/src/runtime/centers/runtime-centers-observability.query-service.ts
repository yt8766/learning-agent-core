import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import type { PlatformApprovalRecord, TaskRecord } from '@agent/core';
import { buildRunBundle } from '@agent/runtime';

import { getPlatformConsoleLogAnalysis as loadPlatformConsoleLogAnalysis } from './runtime-centers-query-diagnostics';
import { matchesRunObservatoryTaskFilters } from './runtime-centers-query-observability';
import {
  resolveInterruptPayloadField,
  resolveTaskExecutionMode,
  resolveTaskInteractionKind
} from './runtime-centers-query.helpers';
import { RuntimeCentersContext } from './runtime-centers.types';
import { getMinistryDisplayName, normalizeExecutionMode } from '../helpers/runtime-architecture-helpers';
import { buildPlatformConsole, buildPlatformConsoleShell } from '../helpers/runtime-platform-console';
import { appendBriefingFeedback, readDailyTechBriefingRuns } from '../briefings/runtime-tech-briefing-storage';
import type { BriefingFeedbackRecord, TechBriefingCategory } from '../briefings/runtime-tech-briefing.types';

interface PlatformApprovalCenterRecord extends PlatformApprovalRecord {
  streamStatus?: unknown;
  contextFilterState?: unknown;
}

export class RuntimeCentersObservabilityQueryService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

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
    const ctx = this.ctx();
    const normalizedExecutionMode = normalizeExecutionMode(filters?.executionMode) ?? filters?.executionMode;
    const limit =
      typeof filters?.limit === 'number'
        ? Math.max(1, Math.floor(filters.limit))
        : typeof filters?.limit === 'string' && filters.limit.trim()
          ? Math.max(1, Math.floor(Number(filters.limit)))
          : undefined;
    return ctx.orchestrator
      .listTasks()
      .filter((task: TaskRecord) => !filters?.status || String(task.status) === filters.status)
      .filter((task: TaskRecord) => matchesRunObservatoryTaskFilters(task, filters))
      .filter(
        (task: TaskRecord) => !normalizedExecutionMode || resolveTaskExecutionMode(task) === normalizedExecutionMode
      )
      .filter(
        (task: TaskRecord) => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind
      )
      .filter((task: TaskRecord) => {
        if (!filters?.q) {
          return true;
        }
        const q = filters.q.toLowerCase();
        return (
          String(task.goal ?? '')
            .toLowerCase()
            .includes(q) ||
          String(task.id ?? '')
            .toLowerCase()
            .includes(q)
        );
      })
      .map(
        (task: TaskRecord) =>
          buildRunBundle(task, task.sessionId ? ctx.wenyuanFacade.getCheckpoint(task.sessionId) : undefined).run
      )
      .filter(run => (filters?.hasInterrupt ? String(run.hasInterrupt) === filters.hasInterrupt : true))
      .filter(run => (filters?.hasFallback ? String(run.hasFallback) === filters.hasFallback : true))
      .filter(run =>
        filters?.hasRecoverableCheckpoint
          ? String(run.hasRecoverableCheckpoint) === filters.hasRecoverableCheckpoint
          : true
      )
      .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
      .slice(0, Number.isFinite(limit) ? limit : undefined);
  }

  async getRunObservatoryDetail(taskId: string) {
    const ctx = this.ctx();
    const task = ctx.orchestrator.listTasks().find((item: TaskRecord) => item.id === taskId);
    if (!task) {
      throw new NotFoundException(`Run ${taskId} not found`);
    }

    return buildRunBundle(task, task.sessionId ? ctx.wenyuanFacade.getCheckpoint(task.sessionId) : undefined);
  }

  getApprovalsCenter(filters?: { executionMode?: string; interactionKind?: string }): PlatformApprovalCenterRecord[] {
    return this.ctx()
      .orchestrator.listPendingApprovals()
      .filter(
        (task: TaskRecord) =>
          !filters?.executionMode ||
          resolveTaskExecutionMode(task) === (normalizeExecutionMode(filters.executionMode) ?? filters.executionMode)
      )
      .filter(
        (task: TaskRecord) => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind
      )
      .map((task: TaskRecord) => ({
        taskId: task.id,
        goal: task.goal,
        status: task.status,
        sessionId: task.sessionId,
        currentMinistry: getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
        currentWorker: task.currentWorker,
        executionMode: toPlatformApprovalExecutionMode(resolveTaskExecutionMode(task)),
        streamStatus: readRecord(task, 'streamStatus'),
        contextFilterState: task.contextFilterState,
        pendingApproval: task.pendingApproval,
        activeInterrupt: task.activeInterrupt,
        entryRouterState: task.entryDecision,
        interruptControllerState: {
          activeInterrupt: task.activeInterrupt,
          interruptHistory: task.interruptHistory ?? []
        },
        planDraft: normalizePlatformApprovalPlanDraft(task.planDraft),
        approvals: task.approvals ?? [],
        lastStreamStatusAt: readStreamStatusUpdatedAt(task)
      }))
      .map(
        (task): PlatformApprovalCenterRecord => ({
          ...task,
          commandPreview: resolveInterruptPayloadField(task.activeInterrupt, 'commandPreview'),
          riskReason: resolveInterruptPayloadField(task.activeInterrupt, 'riskReason'),
          riskCode: resolveInterruptPayloadField(task.activeInterrupt, 'riskCode') || task.pendingApproval?.reasonCode,
          approvalScope: resolveInterruptPayloadField(task.activeInterrupt, 'approvalScope'),
          policyMatchStatus: 'manual-pending',
          policyMatchSource: 'manual'
        })
      );
  }

  async getBrowserReplay(sessionId: string) {
    const replayPath = join(this.ctx().settings.workspaceRoot, 'data', 'browser-replays', sessionId, 'replay.json');
    try {
      const raw = await readFile(replayPath, 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new NotFoundException(`Browser replay ${sessionId} not found`);
    }
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
    const ctx = this.ctx();
    const consoleRecord = await buildPlatformConsole(ctx.getPlatformConsoleContext(), days, filters);
    const totalMs = consoleRecord.diagnostics?.timingsMs.total ?? 0;
    if (ctx.appLogger && totalMs >= 1_000) {
      ctx.appLogger.warn(
        {
          event: 'runtime.platform_console.slow',
          days,
          filters,
          cacheStatus: consoleRecord.diagnostics?.cacheStatus,
          timingsMs: consoleRecord.diagnostics?.timingsMs,
          taskCount: consoleRecord.tasks?.length ?? 0,
          sessionCount: consoleRecord.sessions?.length ?? 0,
          totalDurationMs: totalMs,
          thresholdMs: 1_000
        },
        {
          context: 'RuntimeCentersQueryService',
          days,
          filters,
          cacheStatus: consoleRecord.diagnostics?.cacheStatus,
          timingsMs: consoleRecord.diagnostics?.timingsMs,
          taskCount: consoleRecord.tasks?.length ?? 0,
          sessionCount: consoleRecord.sessions?.length ?? 0
        }
      );
    } else if (ctx.appLogger && consoleRecord.diagnostics?.cacheStatus === 'miss' && totalMs >= 300) {
      ctx.appLogger.log(
        {
          event: 'runtime.platform_console.fresh_aggregate',
          days,
          filters,
          cacheStatus: consoleRecord.diagnostics.cacheStatus,
          timingsMs: consoleRecord.diagnostics.timingsMs,
          taskCount: consoleRecord.tasks?.length ?? 0,
          sessionCount: consoleRecord.sessions?.length ?? 0,
          totalDurationMs: totalMs,
          thresholdMs: 300
        },
        { context: 'RuntimeCentersQueryService' }
      );
    }
    return consoleRecord;
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
    const ctx = this.ctx();
    return buildPlatformConsoleShell(ctx.getPlatformConsoleContext(), days, filters);
  }

  async getPlatformConsoleLogAnalysis(days = 7) {
    return loadPlatformConsoleLogAnalysis(this.ctx(), { days });
  }

  async getBriefingRuns(days = 7, category?: TechBriefingCategory) {
    const runs = await readDailyTechBriefingRuns(this.ctx().settings.workspaceRoot);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return runs
      .filter(run => new Date(run.runAt).getTime() >= cutoff)
      .map(run => ({
        ...run,
        categories: category ? run.categories.filter(item => item.category === category) : run.categories
      }))
      .filter(run => run.categories.length > 0);
  }

  async forceBriefingRun(category: TechBriefingCategory) {
    return this.ctx().techBriefingService?.forceRun(category);
  }

  async recordBriefingFeedback(input: {
    messageKey: string;
    category: TechBriefingCategory;
    feedbackType: 'helpful' | 'notHelpful';
    reasonTag?: 'too-noisy' | 'irrelevant' | 'too-late' | 'useful-actionable';
  }) {
    const payload: BriefingFeedbackRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      messageKey: input.messageKey,
      category: input.category,
      feedbackType: input.feedbackType,
      reasonTag: input.reasonTag,
      createdAt: new Date().toISOString()
    };
    await appendBriefingFeedback(this.ctx().settings.workspaceRoot, payload);
    return { ok: true, payload };
  }

  private ctx() {
    return this.getContext();
  }
}

function toPlatformApprovalExecutionMode(value: string | undefined): PlatformApprovalRecord['executionMode'] {
  if (
    value === 'standard' ||
    value === 'planning-readonly' ||
    value === 'plan' ||
    value === 'execute' ||
    value === 'imperial_direct'
  ) {
    return value;
  }
  return undefined;
}

function normalizePlatformApprovalPlanDraft(value: TaskRecord['planDraft']): PlatformApprovalRecord['planDraft'] {
  if (!value) {
    return undefined;
  }

  return {
    summary: value.summary,
    autoResolved: value.autoResolved,
    openQuestions: value.openQuestions,
    assumptions: value.assumptions,
    questionSet: value.questionSet,
    microBudget: value.microBudget
      ? {
          readOnlyToolLimit: value.microBudget.readOnlyToolLimit,
          readOnlyToolsUsed: value.microBudget.readOnlyToolsUsed,
          tokenBudgetUsd: value.microBudget.tokenBudgetUsd,
          budgetTriggered: Boolean(value.microBudget.budgetTriggered)
        }
      : undefined
  };
}

function readStreamStatusUpdatedAt(task: TaskRecord): string | undefined {
  const streamStatus = readRecord(task, 'streamStatus');
  const updatedAt = streamStatus?.updatedAt;
  return typeof updatedAt === 'string' ? updatedAt : undefined;
}

function readRecord(task: TaskRecord, key: string): Record<string, unknown> | undefined {
  const value = (task as unknown as Record<string, unknown>)[key];
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}
