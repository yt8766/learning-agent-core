import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { NotFoundException } from '@nestjs/common';
import { getMinistryDisplayName, normalizeExecutionMode } from '@agent/shared';

import { buildCompanyAgentsCenter } from './runtime-company-agents-center';
import { buildConnectorsCenter } from './runtime-connectors-center';
import { buildEvidenceCenter, buildLearningCenter } from './runtime-learning-evidence-center';
import { buildRuntimeCenter } from './runtime-runtime-center';
import { buildSkillSourcesCenter } from './runtime-skill-sources-center';
import { buildToolsCenter } from '../tools/runtime-tools-center';
import { getDisabledCompanyWorkerIds } from '../helpers/runtime-connector-registry';
import { summarizeAndPersistEvalHistory, summarizeAndPersistUsageAnalytics } from '../helpers/runtime-metrics-store';
import {
  buildPlatformConsole,
  exportApprovalsCenter,
  exportEvalsCenter,
  exportRuntimeCenter
} from '../helpers/runtime-platform-console';
import { loadPromptRegressionConfigSummary } from '../helpers/prompt-regression-summary';
import { getRecentGovernanceAudit, syncCapabilityGovernanceProfiles } from '../helpers/runtime-governance-store';
import { readInstalledSkillRecords, readSkillInstallReceipts } from '../skills/runtime-skill-install.service';
import {
  listSkillManifests,
  listSkillSources,
  searchLocalSkillSuggestions
} from '../skills/runtime-skill-sources.service';
import { RuntimeCentersContext } from './runtime-centers.types';
import { ingestLocalKnowledge, readKnowledgeOverview } from '../knowledge/runtime-knowledge-store';

export class RuntimeCentersQueryService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

  async getRuntimeCenter(
    days = 30,
    filters?: {
      status?: string;
      model?: string;
      pricingSource?: string;
      executionMode?: string;
      interactionKind?: string;
    }
  ) {
    const ctx = this.ctx();
    const tasks = ctx.orchestrator.listTasks();
    const sessions = ctx.wenyuanFacade.listHistory();
    const pendingApprovals = ctx.orchestrator.listPendingApprovals();
    const usageAnalytics = await summarizeAndPersistUsageAnalytics({
      runtimeStateRepository: ctx.runtimeStateRepository,
      tasks,
      days,
      filters,
      fetchProviderUsageAudit: (auditDays: number) => ctx.fetchProviderUsageAudit(auditDays)
    });
    await syncCapabilityGovernanceProfiles(ctx.runtimeStateRepository, tasks);
    const knowledgeOverview = await ingestLocalKnowledge(ctx.settings);

    const filteredRecentRuns = tasks
      .filter((task: any) => !filters?.status || String(task.status) === filters.status)
      .filter(
        (task: any) =>
          !filters?.executionMode ||
          resolveTaskExecutionMode(task) === (normalizeExecutionMode(filters.executionMode) ?? filters.executionMode)
      )
      .filter((task: any) => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind)
      .slice()
      .sort((left: any, right: any) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 10);

    return {
      ...buildRuntimeCenter({
        profile: ctx.settings.profile,
        policy: {
          approvalMode: ctx.settings.policy.approvalMode,
          skillInstallMode: ctx.settings.policy.skillInstallMode,
          learningMode: ctx.settings.policy.learningMode,
          sourcePolicyMode: ctx.settings.policy.sourcePolicyMode,
          budget: ctx.settings.policy.budget
        },
        tasks,
        sessions,
        pendingApprovals,
        usageAnalytics,
        recentGovernanceAudit: await getRecentGovernanceAudit(ctx.runtimeStateRepository),
        backgroundWorkerPoolSize: ctx.settings.runtimeBackground?.workerPoolSize ?? 2,
        backgroundWorkerSlots: ctx.getBackgroundWorkerSlots(),
        filteredRecentRuns,
        getCheckpoint: (sessionId: string) => ctx.wenyuanFacade.getCheckpoint(sessionId),
        knowledgeOverview
      }),
      tools: buildToolsCenter({
        toolRegistry: ctx.toolRegistry,
        tasks
      }),
      appliedFilters: {
        status: filters?.status,
        model: filters?.model,
        pricingSource: filters?.pricingSource,
        executionMode: filters?.executionMode,
        interactionKind: filters?.interactionKind
      }
    };
  }

  getApprovalsCenter(filters?: { executionMode?: string; interactionKind?: string }) {
    return this.ctx()
      .orchestrator.listPendingApprovals()
      .filter(
        (task: any) =>
          !filters?.executionMode ||
          resolveTaskExecutionMode(task) === (normalizeExecutionMode(filters.executionMode) ?? filters.executionMode)
      )
      .filter((task: any) => !filters?.interactionKind || resolveTaskInteractionKind(task) === filters.interactionKind)
      .map((task: any) => ({
        taskId: task.id,
        goal: task.goal,
        status: task.status,
        sessionId: task.sessionId,
        currentMinistry: getMinistryDisplayName(task.currentMinistry) ?? task.currentMinistry,
        currentWorker: task.currentWorker,
        executionMode: resolveTaskExecutionMode(task),
        pendingApproval: task.pendingApproval,
        // activeInterrupt is the persisted 司礼监 / InterruptController projection for approval-center compatibility.
        activeInterrupt: task.activeInterrupt,
        // entryDecision is the persisted 通政司 / EntryRouter projection for approval-center compatibility.
        entryRouterState: task.entryDecision,
        interruptControllerState: {
          activeInterrupt: task.activeInterrupt,
          interruptHistory: task.interruptHistory ?? []
        },
        planDraft: task.planDraft,
        approvals: task.approvals ?? []
      }));
  }

  getLearningCenter() {
    const ctx = this.ctx();
    const tasks = ctx.orchestrator.listTasks();
    const jobs = ctx.orchestrator.listLearningJobs();
    const learningQueue = ctx.orchestrator.listLearningQueue?.() ?? [];
    const capabilityGovernanceSyncPromise = syncCapabilityGovernanceProfiles(ctx.runtimeStateRepository, tasks);
    const crossCheckEvidencePromise = ctx.wenyuanFacade.listCrossCheckEvidence();
    const memoryStatsPromise = ctx.wenyuanFacade.listMemories().then((items: any[]) => {
      const invalidated = items.filter(item => item.status === 'invalidated').length;
      const quarantinedItems = items
        .filter(item => item.quarantined)
        .sort(
          (left, right) =>
            new Date(right.quarantinedAt ?? right.updatedAt ?? right.createdAt ?? 0).getTime() -
            new Date(left.quarantinedAt ?? left.updatedAt ?? left.createdAt ?? 0).getTime()
        );
      return {
        invalidated,
        quarantined: quarantinedItems.length,
        recentQuarantined: quarantinedItems.slice(0, 8).map(item => ({
          id: item.id,
          summary: item.summary,
          quarantineReason: item.quarantineReason,
          quarantineCategory: item.quarantineCategory,
          quarantineReasonDetail: item.quarantineReasonDetail,
          quarantineRestoreSuggestion: item.quarantineRestoreSuggestion,
          quarantinedAt: item.quarantinedAt
        }))
      };
    });
    const invalidatedRulesPromise = ctx.ruleRepository
      .list()
      .then((items: any[]) => items.filter(item => item.status === 'invalidated').length);
    return buildLearningCenter({
      tasks,
      jobs,
      wenyuanOverviewPromise: ctx.wenyuanFacade.getOverview(),
      knowledgeOverviewPromise: ingestLocalKnowledge(ctx.settings),
      learningQueue,
      memoryStatsPromise,
      invalidatedRulesPromise,
      crossCheckEvidencePromise,
      governanceSnapshotPromise: capabilityGovernanceSyncPromise.then(() => ctx.runtimeStateRepository.load()),
      resolveLocalSkillSuggestions: (task: any) =>
        resolveLocalSkillSuggestionsWithTimeout(() =>
          searchLocalSkillSuggestions(ctx.getSkillSourcesContext(), task.goal, {
            usedInstalledSkills: task.usedInstalledSkills,
            limit: 3
          })
        )
    });
  }

  getEvidenceCenter() {
    const ctx = this.ctx();
    const tasks = ctx.orchestrator.listTasks();
    const jobs = ctx.orchestrator.listLearningJobs();
    return Promise.all([ctx.wenyuanFacade.getOverview(), ingestLocalKnowledge(ctx.settings)]).then(
      ([wenyuanOverview, knowledgeOverview]) =>
        buildEvidenceCenter({
          tasks,
          jobs,
          getCheckpoint: (sessionId: string) => ctx.wenyuanFacade.getCheckpoint(sessionId),
          wenyuanOverview,
          knowledgeOverview
        })
    );
  }

  async getConnectorsCenter() {
    const ctx = this.ctx();
    await ctx.mcpClientManager.sweepIdleSessions(ctx.settings.mcp.stdioSessionIdleTtlMs);
    await ctx.mcpClientManager.refreshAllServerDiscovery({ includeStdio: false }).catch(() => undefined);
    const [snapshot, knowledgeOverview] = await Promise.all([
      ctx.runtimeStateRepository.load(),
      readKnowledgeOverview(ctx.settings)
    ]);
    const tasks = ctx.orchestrator.listTasks();
    return buildConnectorsCenter({
      profile: ctx.settings.profile,
      snapshot,
      tasks,
      connectors: ctx.mcpClientManager.describeServers(),
      knowledgeOverview
    });
  }

  getToolsCenter() {
    const ctx = this.ctx();
    return buildToolsCenter({
      toolRegistry: ctx.toolRegistry,
      tasks: ctx.orchestrator.listTasks()
    });
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

  async getSkillSourcesCenter() {
    const ctx = this.ctx();
    const [sources, manifests, installed, receipts] = await Promise.all([
      listSkillSources(ctx.getSkillSourcesContext()),
      listSkillManifests(ctx.getSkillSourcesContext()),
      readInstalledSkillRecords(ctx.getSkillInstallContext()),
      readSkillInstallReceipts(ctx.getSkillInstallContext())
    ]);
    const skillCards = await ctx.skillRegistry.list();
    const tasks = ctx.orchestrator.listTasks();
    return buildSkillSourcesCenter({
      sources,
      manifests,
      installed,
      receipts,
      skillCards,
      tasks
    });
  }

  getCompanyAgentsCenter() {
    const ctx = this.ctx();
    return buildCompanyAgentsCenter({
      tasks: ctx.orchestrator.listTasks(),
      workers: ctx.orchestrator.listWorkers(),
      disabledWorkerIds: new Set(getDisabledCompanyWorkerIds(ctx.getConnectorRegistryContext()))
    });
  }

  async getEvalsCenter(days = 30, filters?: { scenarioId?: string; outcome?: string }) {
    const ctx = this.ctx();
    const [evals, promptRegression] = await Promise.all([
      summarizeAndPersistEvalHistory({
        runtimeStateRepository: ctx.runtimeStateRepository,
        tasks: ctx.orchestrator.listTasks(),
        days,
        filters
      }),
      loadPromptRegressionConfigSummary(ctx.settings.workspaceRoot)
    ]);

    return {
      ...evals,
      promptRegression
    };
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
    return buildPlatformConsole(this.ctx().getPlatformConsoleContext(), days, filters);
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

  private ctx() {
    return this.getContext();
  }
}

function resolveTaskInteractionKind(task: any) {
  // activeInterrupt is the persisted 司礼监 / InterruptController projection for center filtering.
  if (typeof task.activeInterrupt?.interactionKind === 'string') {
    return task.activeInterrupt.interactionKind;
  }
  const payload = task.activeInterrupt?.payload;
  if (payload && typeof payload === 'object' && typeof payload.interactionKind === 'string') {
    return payload.interactionKind;
  }
  if (task.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  return task.pendingApproval || task.activeInterrupt ? 'approval' : undefined;
}

function resolveTaskExecutionMode(task: any) {
  return String(
    normalizeExecutionMode(
      task.executionMode ??
        task.executionPlan?.mode ??
        (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute')
    ) ?? 'execute'
  );
}

async function resolveLocalSkillSuggestionsWithTimeout(
  resolver: () => Promise<{
    suggestions: unknown[];
    gapSummary?: string;
    profile?: string;
    usedInstalledSkills?: string[];
  }>
) {
  const timeoutMs = 250;
  const timeoutResult = {
    suggestions: [],
    gapSummary: 'local-skill-suggestions-timeout',
    profile: undefined,
    usedInstalledSkills: []
  };

  return Promise.race([
    resolver().catch(() => timeoutResult),
    new Promise<typeof timeoutResult>(resolve => {
      setTimeout(() => resolve(timeoutResult), timeoutMs);
    })
  ]);
}
