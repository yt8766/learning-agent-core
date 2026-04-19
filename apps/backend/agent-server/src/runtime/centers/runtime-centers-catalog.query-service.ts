import { RuntimeCentersContext } from './runtime-centers.types';
import { buildCompanyAgentsCenter } from './runtime-company-agents-center';
import { loadConnectorsCenter } from './runtime-centers-query-connectors';
import { loadEvalsCenterMetrics } from './runtime-centers-query-metrics';
import { buildSkillSourcesCenter } from './runtime-skill-sources-center';
import { buildToolsCenter } from '../tools/runtime-tools-center';
import { getDisabledCompanyWorkerIds } from '../helpers/runtime-connector-registry';
import { loadPromptRegressionConfigSummary } from '../helpers/prompt-regression-summary';
import { readInstalledSkillRecords, readSkillInstallReceipts } from '../skills/runtime-skill-install.service';
import { listSkillManifests, listSkillSources } from '../skills/runtime-skill-sources.service';
import type { EvalsCenterRecord } from './runtime-centers.records';

export class RuntimeCentersCatalogQueryService {
  constructor(private readonly getContext: () => RuntimeCentersContext) {}

  async getConnectorsCenter() {
    return loadConnectorsCenter(this.ctx());
  }

  getToolsCenter() {
    const ctx = this.ctx();
    return buildToolsCenter({
      toolRegistry: ctx.toolRegistry,
      tasks: ctx.orchestrator.listTasks()
    });
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

  async getEvalsCenter(
    days = 30,
    filters?: { scenarioId?: string; outcome?: string; metricsMode?: 'live' | 'snapshot-preferred' }
  ): Promise<EvalsCenterRecord> {
    const ctx = this.ctx();
    const [evals, promptRegression] = await Promise.all([
      loadEvalsCenterMetrics(ctx, days, filters),
      loadPromptRegressionConfigSummary(ctx.settings.workspaceRoot)
    ]);

    return {
      ...evals,
      promptRegression
    };
  }

  async getEvalsCenterSummary(
    days = 30,
    filters?: { scenarioId?: string; outcome?: string; metricsMode?: 'live' | 'snapshot-preferred' }
  ): Promise<EvalsCenterRecord> {
    const ctx = this.ctx();
    const evals = await loadEvalsCenterMetrics(ctx, days, filters);

    return {
      ...evals,
      recentRuns: [],
      scenarioTrends: [],
      promptRegression: undefined
    };
  }

  private ctx() {
    return this.getContext();
  }
}
