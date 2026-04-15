import {
  executeDataReportJsonGraph,
  DATA_REPORT_JSON_DEFAULT_MODEL_POLICY,
  type DataReportJsonGenerateResult,
  type DataReportJsonNodeModelPolicy,
  type DataReportJsonSchema,
  type DataReportJsonNodeStageEvent
} from '@agent/agents-data-report';

import type { RuntimeHost } from '../runtime/core/runtime.host';
import type { DirectChatRequestDto, DirectChatSseEvent } from './chat.direct.dto';
import { extractDirectGoal } from './chat-direct-response.helpers';

export async function streamReportSchema(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void
): Promise<DataReportJsonGenerateResult> {
  const llm = runtimeHost.llmProvider;
  const goal = extractDirectGoal(dto);
  const stageStartedAt = new Map<string, number>();
  const pendingStages = new Set<string>();
  const strictLlmBrandNew =
    dto.preferLlm === true || dto.reportSchemaInput?.generationHints?.targetLatencyClass === 'quality';
  const nodeModelPolicy = resolveReportSchemaNodeModelPolicy(runtimeHost, dto, strictLlmBrandNew);
  const heartbeat = setInterval(() => {
    for (const stage of pendingStages) {
      const startedAt = stageStartedAt.get(stage);
      onEvent({
        type: 'stage',
        data: {
          stage,
          status: 'pending',
          details: {
            elapsedMs: startedAt ? Date.now() - startedAt : undefined,
            heartbeat: true
          }
        }
      });
    }
  }, 2_000);
  heartbeat.unref?.();

  let graphResult;
  try {
    const disableCache = dto.disableCache ?? true;
    graphResult = await executeDataReportJsonGraph({
      llm,
      goal,
      reportSchemaInput: dto.reportSchemaInput,
      strictLlmBrandNew,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      disableCache,
      artifactCacheKey: disableCache ? undefined : resolveReportSchemaArtifactCacheKey(runtimeHost, dto),
      nodeModelPolicy,
      nodeModelOverrides: dto.modelId
        ? {
            schemaSpecNode: dto.modelId,
            filterSchemaNode: dto.modelId,
            dataSourceNode: dto.modelId,
            sectionPlanNode: dto.modelId,
            metricsBlockNode: dto.modelId,
            chartBlockNode: dto.modelId,
            tableBlockNode: dto.modelId,
            sectionSchemaNode: dto.modelId,
            patchSchemaNode: dto.modelId
          }
        : undefined,
      onStage: (event: DataReportJsonNodeStageEvent) => {
        if (event.status === 'pending') {
          stageStartedAt.set(event.node, Date.now());
          pendingStages.add(event.node);
        } else {
          pendingStages.delete(event.node);
        }
        const startedAt = stageStartedAt.get(event.node);
        onEvent({
          type: 'stage',
          data: {
            stage: event.node,
            status: event.status,
            details: {
              ...event.details,
              elapsedMs: event.status === 'pending' || !startedAt ? undefined : Date.now() - startedAt
            }
          }
        });
      },
      onArtifact: event => {
        onEvent({
          type: 'schema_progress',
          data: {
            phase: event.phase,
            blockType: event.blockType,
            schema: event.schema
          }
        });
      }
    });
  } finally {
    clearInterval(heartbeat);
  }

  if (graphResult.status === 'failed') {
    onEvent({
      type: 'schema_failed',
      data: {
        error: graphResult.error,
        reportSummaries: graphResult.reportSummaries,
        runtime: graphResult.runtime
      }
    });
    return graphResult;
  }

  if (graphResult.status === 'partial') {
    onEvent({
      type: 'schema_partial',
      data: {
        schema: graphResult.partialSchema,
        error: graphResult.error,
        reportSummaries: graphResult.reportSummaries,
        runtime: graphResult.runtime
      }
    });
    return graphResult;
  }

  onEvent({
    type: 'schema_ready',
    data: {
      schema: graphResult.schema,
      reportSummaries: graphResult.reportSummaries,
      runtime: graphResult.runtime
    }
  });

  return {
    ...graphResult,
    schema: graphResult.schema as DataReportJsonSchema,
    content: graphResult.content,
    elapsedMs: graphResult.elapsedMs
  };
}

function resolveReportSchemaNodeModelPolicy(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  strictLlmBrandNew = false
): DataReportJsonNodeModelPolicy {
  if (dto.modelId) {
    return {
      analysisNode: { primary: dto.modelId },
      schemaSpecNode: { primary: dto.modelId },
      filterSchemaNode: { primary: dto.modelId, fallback: dto.modelId },
      dataSourceNode: { primary: dto.modelId, fallback: dto.modelId },
      sectionPlanNode: { primary: dto.modelId, fallback: dto.modelId },
      metricsBlockNode: { primary: dto.modelId, fallback: dto.modelId },
      chartBlockNode: { primary: dto.modelId, fallback: dto.modelId },
      tableBlockNode: { primary: dto.modelId, fallback: dto.modelId },
      sectionSchemaNode: { primary: dto.modelId, complex: dto.modelId, fallback: dto.modelId },
      patchIntentNode: { primary: dto.modelId },
      patchSchemaNode: { primary: dto.modelId, complex: dto.modelId, fallback: dto.modelId }
    };
  }

  const heavyModelId =
    runtimeHost.settings?.zhipuModels?.research ??
    runtimeHost.settings?.policy?.budget?.fallbackModelId ??
    DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary;
  const fastModelId = DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary;

  if (strictLlmBrandNew) {
    return {
      analysisNode: { primary: fastModelId },
      schemaSpecNode: { primary: heavyModelId },
      filterSchemaNode: { primary: fastModelId, fallback: heavyModelId },
      dataSourceNode: { primary: fastModelId, fallback: heavyModelId },
      sectionPlanNode: { primary: heavyModelId, fallback: fastModelId },
      metricsBlockNode: { primary: fastModelId, fallback: heavyModelId },
      chartBlockNode: { primary: heavyModelId, fallback: fastModelId },
      tableBlockNode: { primary: fastModelId, fallback: heavyModelId },
      sectionSchemaNode: { primary: fastModelId, complex: heavyModelId, fallback: heavyModelId },
      patchIntentNode: { primary: fastModelId },
      patchSchemaNode: { primary: fastModelId, complex: heavyModelId, fallback: heavyModelId }
    };
  }

  return {
    analysisNode: { primary: fastModelId },
    schemaSpecNode: { primary: heavyModelId },
    filterSchemaNode: { primary: fastModelId, fallback: heavyModelId },
    dataSourceNode: { primary: fastModelId, fallback: heavyModelId },
    sectionPlanNode: { primary: fastModelId, fallback: heavyModelId },
    metricsBlockNode: { primary: fastModelId, fallback: heavyModelId },
    chartBlockNode: { primary: fastModelId, fallback: heavyModelId },
    tableBlockNode: { primary: fastModelId, fallback: heavyModelId },
    sectionSchemaNode: { primary: fastModelId, complex: heavyModelId, fallback: heavyModelId },
    patchIntentNode: { primary: fastModelId },
    patchSchemaNode: { primary: fastModelId, complex: heavyModelId, fallback: heavyModelId }
  };
}

export function resolveReportSchemaArtifactCacheKey(runtimeHost: RuntimeHost, dto: DirectChatRequestDto) {
  const cacheVersion = 'v3-strict-llm-block-live';
  const latencyStrategy =
    dto.preferLlm === true ? 'strict-llm' : (dto.reportSchemaInput?.generationHints?.targetLatencyClass ?? 'balanced');
  const heavyModelId =
    dto.modelId ??
    runtimeHost.settings?.zhipuModels?.research ??
    runtimeHost.settings?.policy?.budget?.fallbackModelId ??
    DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary;
  const fastModelId =
    dto.modelId ??
    runtimeHost.settings?.zhipuModels?.manager ??
    DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary;
  const reportId = dto.reportSchemaInput?.meta.reportId?.trim();

  if (reportId) {
    return `report-schema:${cacheVersion}:${latencyStrategy}:${fastModelId}:${heavyModelId}:${reportId}`;
  }

  const goal = extractDirectGoal(dto);
  return goal ? `report-schema:${cacheVersion}:${latencyStrategy}:${fastModelId}:${heavyModelId}:${goal}` : undefined;
}
