import { getRecentGovernanceAudit, listApprovalScopePolicies, syncCapabilityGovernanceProfiles } from '@agent/runtime';

import { RuntimeCentersContext } from './runtime-centers.types';
import { loadRuntimeUsageAnalytics } from './runtime-centers-query-metrics';
import { ingestLocalKnowledge } from '../knowledge/runtime-knowledge-store';
import { readDailyTechBriefingStatus } from '../briefings/runtime-tech-briefing-status';
import { filterAndSortRecentRuntimeRuns } from '../domain/metrics/runtime-recent-runs';
import { getMinistryDisplayName } from '../helpers/runtime-architecture-helpers';
import { buildRuntimeCenter, buildRuntimeCenterSummary } from './runtime-runtime-center';
import { buildToolsCenter } from '../tools/runtime-tools-center';

export class RuntimeCentersRuntimeQueryService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

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
    const ctx = this.ctx();
    const tasks = ctx.orchestrator.listTasks();
    const sessions = ctx.wenyuanFacade.listHistory();
    const pendingApprovals = ctx.orchestrator.listPendingApprovals();
    const usageAnalytics = await loadRuntimeUsageAnalytics(ctx, tasks, days, filters);
    await syncCapabilityGovernanceProfiles(ctx.runtimeStateRepository, tasks);
    const approvalScopePolicies = await listApprovalScopePolicies(ctx.runtimeStateRepository);
    const knowledgeOverview = await ingestLocalKnowledge(ctx.settings);
    const dailyTechBriefing = await readDailyTechBriefingStatus(ctx.settings.workspaceRoot, {
      enabled: ctx.settings.dailyTechBriefing.enabled,
      schedule: ctx.settings.dailyTechBriefing.schedule
    });

    const filteredRecentRuns = filterAndSortRecentRuntimeRuns(tasks, filters);

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
        approvalScopePolicies,
        backgroundWorkerPoolSize: ctx.settings.runtimeBackground?.workerPoolSize ?? 2,
        backgroundWorkerSlots: ctx.getBackgroundWorkerSlots(),
        filteredRecentRuns,
        getCheckpoint: (sessionId: string) => ctx.wenyuanFacade.getCheckpoint(sessionId),
        runtimeHost: ctx.runtimeHost,
        knowledgeOverview,
        dailyTechBriefing
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

  async getRuntimeCenterSummary(
    _days = 30,
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

    const filteredRecentRuns = filterAndSortRecentRuntimeRuns(tasks, filters);

    return {
      ...buildRuntimeCenterSummary({
        tasks,
        sessions,
        pendingApprovals,
        filteredRecentRuns,
        getMinistryDisplayName
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

  private ctx() {
    return this.getContext();
  }
}
