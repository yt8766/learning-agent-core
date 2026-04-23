import { RuntimeCentersContext } from './runtime-centers.types';
import { loadConnectorsCenter } from './runtime-centers-query-connectors';
import { loadEvalsCenterMetrics } from './runtime-centers-query-metrics';
import { buildToolsCenter } from '../tools/runtime-tools-center';
import { loadPromptRegressionConfigSummary } from '../helpers/prompt-regression-summary';
import type { EvalsCenterRecord } from './runtime-centers.records';
import { loadCompanyAgentsCenterRecord } from '../domain/governance/runtime-company-agents-view';
import { loadSkillSourcesCenterRecord } from '../domain/skills/runtime-skill-sources-center-loader';

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
    return loadSkillSourcesCenterRecord(this.ctx());
  }

  getCompanyAgentsCenter() {
    return loadCompanyAgentsCenterRecord(this.ctx());
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
