import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import type {
  IntelligenceChannel,
  IntelligenceOverviewProjection,
  PlatformApprovalRecord,
  TaskRecord
} from '@agent/core';
import { buildRunBundle } from '@agent/runtime';

import { getPlatformConsoleLogAnalysis as loadPlatformConsoleLogAnalysis } from './runtime-centers-query-diagnostics';
import { RuntimeCentersContext } from './runtime-centers.types';
import { getMinistryDisplayName } from '../helpers/runtime-architecture-helpers';
import { buildPlatformConsole, buildPlatformConsoleShell } from '../helpers/runtime-platform-console';
import { buildApprovalsCenterRecords } from '../domain/observability/runtime-approvals-center';
import {
  filterAndSortRunObservatoryRuns,
  filterAndSortRunObservatoryTasks,
  parseRunObservatoryLimit
} from '../domain/observability/runtime-run-observatory';

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
    const limit = parseRunObservatoryLimit(filters?.limit);
    const runs = filterAndSortRunObservatoryTasks(ctx.orchestrator.listTasks(), filters).map(
      (task: TaskRecord) =>
        buildRunBundle(task, task.sessionId ? ctx.wenyuanFacade.getCheckpoint(task.sessionId) : undefined).run
    );
    return filterAndSortRunObservatoryRuns(runs, filters, limit);
  }

  async getRunObservatoryDetail(taskId: string) {
    const ctx = this.ctx();
    const task = ctx.orchestrator.listTasks().find((item: TaskRecord) => item.id === taskId);
    if (!task) {
      throw new NotFoundException(`Run ${taskId} not found`);
    }

    return buildRunBundle(task, task.sessionId ? ctx.wenyuanFacade.getCheckpoint(task.sessionId) : undefined);
  }

  getApprovalsCenter(filters?: { executionMode?: string; interactionKind?: string }): PlatformApprovalRecord[] {
    return buildApprovalsCenterRecords({
      tasks: this.ctx().orchestrator.listPendingApprovals(),
      getMinistryDisplayName,
      filters
    });
  }

  async getBrowserReplay(sessionId: string) {
    const replayPath = join(
      this.ctx().settings.workspaceRoot,
      'artifacts',
      'runtime',
      'browser-replays',
      sessionId,
      'replay.json'
    );
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

  async getIntelligenceOverview(): Promise<IntelligenceOverviewProjection> {
    const repository = this.ctx().intelligenceRepository;
    const generatedAt = new Date().toISOString();
    if (!repository) {
      return {
        generatedAt,
        channels: [],
        recentSignals: [],
        pendingCandidates: []
      };
    }

    const [recentSignals, pendingCandidates] = await Promise.all([
      repository.listRecentSignals({ limit: 20 }),
      repository.listPendingCandidates({ limit: 20 })
    ]);

    return {
      generatedAt,
      channels: [],
      recentSignals,
      pendingCandidates
    };
  }

  async forceIntelligenceRun(channel: IntelligenceChannel) {
    const runService = this.ctx().intelligenceRunService;
    if (!runService) {
      throw new Error('Intelligence run service is not configured.');
    }
    return runService.forceRun(channel);
  }

  private ctx() {
    return this.getContext();
  }
}
