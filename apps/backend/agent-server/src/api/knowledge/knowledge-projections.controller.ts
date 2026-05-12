import { Controller, Get, Param, Post, Put, Body } from '@nestjs/common';
import {
  KnowledgeDashboardOverviewSchema,
  KnowledgeEvalCaseResultSchema,
  KnowledgeEvalCaseSchema,
  KnowledgeEvalDatasetSchema,
  KnowledgeEvalRunComparisonSchema,
  KnowledgeEvalRunSchema,
  KnowledgeObservabilityMetricsSchema,
  KnowledgePageResultSchema,
  KnowledgeRagTraceDetailSchema,
  KnowledgeRagTraceSchema
} from '@agent/core';
import {
  KnowledgeAgentFlowListResponseSchema,
  KnowledgeAgentFlowRunResponseSchema,
  KnowledgeAgentFlowSaveResponseSchema
} from '@agent/knowledge';

import { KnowledgeEvalService } from '../../domains/knowledge/services/knowledge-eval.service';
import { KnowledgeAgentFlowService } from '../../domains/knowledge/services/knowledge-agent-flow.service';
import { KnowledgeDashboardService } from '../../domains/knowledge/services/knowledge-dashboard.service';
import { KnowledgeObservabilityService } from '../../domains/knowledge/services/knowledge-observability.service';
import { KnowledgeServiceError } from '../../domains/knowledge/services/knowledge-service.error';

@Controller('knowledge')
export class KnowledgeProjectionsController {
  constructor(
    private readonly evalService: KnowledgeEvalService,
    private readonly agentFlowService: KnowledgeAgentFlowService,
    private readonly dashboard: KnowledgeDashboardService,
    private readonly observability: KnowledgeObservabilityService
  ) {}

  @Get('dashboard/overview')
  async getDashboardOverview() {
    return KnowledgeDashboardOverviewSchema.parse(await this.dashboard.getOverview());
  }

  @Get('observability/metrics')
  async getObservabilityMetrics() {
    return KnowledgeObservabilityMetricsSchema.parse(await this.observability.getMetrics());
  }

  @Get('observability/traces')
  async listObservabilityTraces() {
    return KnowledgePageResultSchema(KnowledgeRagTraceSchema).parse(await this.observability.listTraces());
  }

  @Get('observability/traces/:traceId')
  async getObservabilityTrace(@Param('traceId') traceId: string) {
    return KnowledgeRagTraceDetailSchema.parse(await this.observability.getTrace(traceId));
  }

  @Get('eval/datasets')
  async listEvalDatasets() {
    const service = this.evalService as unknown as { listDatasets?: () => Promise<unknown> };
    if (service.listDatasets) {
      return KnowledgePageResultSchema(KnowledgeEvalDatasetSchema).parse(await service.listDatasets());
    }
    return KnowledgePageResultSchema(KnowledgeEvalDatasetSchema).parse({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
  }

  @Post('eval/datasets')
  async createEvalDataset(@Body() body: unknown) {
    const service = this.evalService as unknown as { createDataset?: (input: unknown) => Promise<unknown> };
    if (service.createDataset) {
      return KnowledgeEvalDatasetSchema.parse(await service.createDataset(body));
    }
    return KnowledgeEvalDatasetSchema.parse(body);
  }

  @Get('eval/datasets/:datasetId/cases')
  async listEvalCases(@Param('datasetId') datasetId: string) {
    const service = this.evalService as unknown as { listCases?: (datasetId: string) => Promise<unknown> };
    if (service.listCases) {
      return KnowledgePageResultSchema(KnowledgeEvalCaseSchema).parse(await service.listCases(datasetId));
    }
    return KnowledgePageResultSchema(KnowledgeEvalCaseSchema).parse({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
  }

  @Post('eval/datasets/:datasetId/cases')
  async createEvalCase(@Param('datasetId') datasetId: string, @Body() body: unknown) {
    const service = this.evalService as unknown as {
      createCase?: (datasetId: string, input: unknown) => Promise<unknown>;
    };
    if (service.createCase) {
      return KnowledgeEvalCaseSchema.parse(await service.createCase(datasetId, body));
    }
    return KnowledgeEvalCaseSchema.parse(body);
  }

  @Get('eval/runs')
  async listEvalRuns() {
    const service = this.evalService as unknown as { listRuns?: () => Promise<unknown> };
    if (service.listRuns) {
      return KnowledgePageResultSchema(KnowledgeEvalRunSchema).parse(await service.listRuns());
    }
    return KnowledgePageResultSchema(KnowledgeEvalRunSchema).parse({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
  }

  @Post('eval/runs')
  async createEvalRun(@Body() body: unknown) {
    const service = this.evalService as unknown as { createRun?: (input: unknown) => Promise<unknown> };
    if (service.createRun) {
      return KnowledgeEvalRunSchema.parse(await service.createRun(body));
    }
    return KnowledgeEvalRunSchema.parse(body);
  }

  @Get('eval/runs/:runId/results')
  async listEvalRunResults(@Param('runId') runId: string) {
    const service = this.evalService as unknown as { listRunResults?: (runId: string) => Promise<unknown> };
    if (service.listRunResults) {
      return KnowledgePageResultSchema(KnowledgeEvalCaseResultSchema).parse(await service.listRunResults(runId));
    }
    return KnowledgePageResultSchema(KnowledgeEvalCaseResultSchema).parse({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
  }

  @Post('eval/runs/compare')
  async compareEvalRuns(@Body() body: unknown) {
    const result = this.evalService.compareRuns(body as { baselineRunId?: string; candidateRunId?: string });
    return KnowledgeEvalRunComparisonSchema.parse({
      runs: [],
      metrics: [
        { name: 'totalScoreDelta', values: [result.totalScoreDelta] },
        { name: 'retrievalScoreDelta', values: [result.retrievalScoreDelta] },
        { name: 'generationScoreDelta', values: [result.generationScoreDelta] }
      ]
    });
  }

  @Get('agent-flows')
  async listAgentFlows() {
    return KnowledgeAgentFlowListResponseSchema.parse(await this.agentFlowService.listFlows());
  }

  @Post('agent-flows')
  async saveAgentFlow(@Body() body: unknown) {
    return KnowledgeAgentFlowSaveResponseSchema.parse(await this.agentFlowService.saveFlow(body));
  }

  @Put('agent-flows/:flowId')
  async updateAgentFlow(@Param('flowId') flowId: string, @Body() body: unknown) {
    return KnowledgeAgentFlowSaveResponseSchema.parse(await this.agentFlowService.updateFlow(flowId, body));
  }

  @Post('agent-flows/:flowId/run')
  async runAgentFlow(@Param('flowId') flowId: string, @Body() body: unknown) {
    return KnowledgeAgentFlowRunResponseSchema.parse(await this.agentFlowService.runFlow(flowId, body));
  }
}
