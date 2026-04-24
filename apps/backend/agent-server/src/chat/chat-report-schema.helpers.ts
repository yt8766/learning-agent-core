import {
  executeReportBundleEditFlow,
  executeDataReportJsonGraph,
  executeReportBundleGenerateFlow,
  DATA_REPORT_JSON_DEFAULT_MODEL_POLICY,
  type DataReportBundleGenerateResult,
  type DataReportJsonNodeModelSelector,
  type DataReportJsonNodeModelPolicy,
  type DataReportJsonNodeStageEvent
} from '../runtime/core/runtime-data-report-facade';
import { resolveActiveRoleModels } from '@agent/config';

import type { RuntimeHost } from '../runtime/core/runtime.host';
import type { DirectChatRequestDto, DirectChatSseEvent } from './chat.direct.dto';
import { extractDirectGoal } from './chat-direct-response.helpers';

export async function streamReportSchema(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void
): Promise<DataReportBundleGenerateResult> {
  const llm = runtimeHost.llmProvider;
  const goal = resolveReportSchemaGoal(dto);
  if (isLegacyPatchRequest(goal)) {
    const legacyUnsupportedResult = buildLegacyPatchUnsupportedResult();
    onEvent({
      type: 'schema_failed',
      data: {
        error: legacyUnsupportedResult.error
      }
    });
    return legacyUnsupportedResult;
  }

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
    const stageHandler = (event: DataReportJsonNodeStageEvent) => {
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
    };
    const artifactHandler = (event: { phase: string; blockType?: string; schema: unknown }) => {
      onEvent({
        type: 'schema_progress',
        data: {
          phase: event.phase,
          blockType: event.blockType,
          schema: event.schema
        }
      });
    };

    graphResult = dto.currentBundle
      ? await executeReportBundleEditFlow({
          currentBundle: dto.currentBundle,
          requestedOperations: dto.requestedOperations,
          messages: resolveReportBundleMessages(dto, goal),
          llm,
          modelId: dto.modelId,
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
          onStage: stageHandler,
          onArtifact: artifactHandler
        }).then(result => {
          const { primaryDocument: _primaryDocument, runtime, ...rest } = result;
          return {
            ...rest,
            runtime
          };
        })
      : await executeReportBundleGenerateFlow({
          llm,
          messages: resolveReportBundleMessages(dto, goal),
          structuredSeed: dto.reportSchemaInput,
          strictLlmBrandNew,
          modelId: dto.modelId,
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
          onStage: stageHandler,
          onArtifact: artifactHandler
        }).then(result => {
          const { primaryDocument: _primaryDocument, runtime, ...rest } = result;
          return {
            ...rest,
            runtime: runtime.jsonRuntime ?? undefined
          };
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
      ...(graphResult.bundle ? { bundle: graphResult.bundle } : {}),
      reportSummaries: graphResult.reportSummaries,
      runtime: graphResult.runtime
    }
  });

  return graphResult;
}

function buildLegacyPatchUnsupportedResult(): DataReportBundleGenerateResult {
  return {
    status: 'failed',
    error: {
      errorCode: 'report_schema_generation_failed',
      errorMessage:
        'Legacy CHANGE_REQUEST + CURRENT_SCHEMA payloads are no longer supported. Use currentBundle with requestedOperations or messages.',
      retryable: false
    },
    content: '',
    elapsedMs: 0
  };
}

function isLegacyPatchRequest(goal: string) {
  return goal.includes('CHANGE_REQUEST:') && goal.includes('CURRENT_SCHEMA:');
}

function resolveReportSchemaGoal(dto: DirectChatRequestDto) {
  if (dto.message?.trim() || dto.messages?.length) {
    return extractDirectGoal(dto);
  }

  if (dto.requestedOperations?.length) {
    return dto.requestedOperations
      .map(operation => operation.summary.trim())
      .filter(Boolean)
      .join('\n');
  }

  if (dto.currentBundle) {
    return dto.currentBundle.meta.title;
  }

  return extractDirectGoal(dto);
}

function resolveReportBundleMessages(dto: DirectChatRequestDto, goal: string) {
  if (dto.messages?.length) {
    return dto.messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  }

  return [{ role: 'user' as const, content: goal }];
}

function resolveReportSchemaNodeModelPolicy(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  strictLlmBrandNew = false
): DataReportJsonNodeModelPolicy {
  const fastSelector = createReportSchemaNodeSelector('fast', runtimeHost, dto);
  const qualitySelector = createReportSchemaNodeSelector('quality', runtimeHost, dto);

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

  if (strictLlmBrandNew) {
    return {
      analysisNode: { primary: fastSelector },
      schemaSpecNode: { primary: qualitySelector },
      filterSchemaNode: { primary: fastSelector, fallback: qualitySelector },
      dataSourceNode: { primary: fastSelector, fallback: qualitySelector },
      sectionPlanNode: { primary: qualitySelector, fallback: fastSelector },
      metricsBlockNode: { primary: fastSelector, fallback: qualitySelector },
      chartBlockNode: { primary: qualitySelector, fallback: fastSelector },
      tableBlockNode: { primary: fastSelector, fallback: qualitySelector },
      sectionSchemaNode: { primary: fastSelector, complex: qualitySelector, fallback: qualitySelector },
      patchIntentNode: { primary: fastSelector },
      patchSchemaNode: { primary: fastSelector, complex: qualitySelector, fallback: qualitySelector }
    };
  }

  return {
    analysisNode: { primary: fastSelector },
    schemaSpecNode: { primary: qualitySelector },
    filterSchemaNode: { primary: fastSelector, fallback: qualitySelector },
    dataSourceNode: { primary: fastSelector, fallback: qualitySelector },
    sectionPlanNode: { primary: fastSelector, fallback: qualitySelector },
    metricsBlockNode: { primary: fastSelector, fallback: qualitySelector },
    chartBlockNode: { primary: fastSelector, fallback: qualitySelector },
    tableBlockNode: { primary: fastSelector, fallback: qualitySelector },
    sectionSchemaNode: { primary: fastSelector, complex: qualitySelector, fallback: qualitySelector },
    patchIntentNode: { primary: fastSelector },
    patchSchemaNode: { primary: fastSelector, complex: qualitySelector, fallback: qualitySelector }
  };
}

function createReportSchemaNodeSelector(
  tier: 'fast' | 'quality',
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto
): DataReportJsonNodeModelSelector {
  const settings = runtimeHost.settings;
  const roleModels = resolveActiveRoleModels(settings);
  const preferredModelIds =
    tier === 'fast'
      ? [
          roleModels.manager,
          roleModels.executor,
          settings?.policy?.budget?.fallbackModelId,
          typeof DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary === 'string'
            ? DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary
            : undefined
        ]
      : [
          roleModels.research,
          roleModels.reviewer,
          settings?.policy?.budget?.fallbackModelId,
          typeof DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary === 'string'
            ? DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary
            : undefined
        ];

  return {
    tier,
    role: tier === 'fast' ? 'manager' : 'research',
    preferredModelIds: Array.from(
      new Set([dto.modelId, ...preferredModelIds].filter((value): value is string => Boolean(value)))
    )
  };
}

export function resolveReportSchemaArtifactCacheKey(runtimeHost: RuntimeHost, dto: DirectChatRequestDto) {
  const cacheVersion = 'v3-strict-llm-block-live';
  const latencyStrategy =
    dto.preferLlm === true ? 'strict-llm' : (dto.reportSchemaInput?.generationHints?.targetLatencyClass ?? 'balanced');
  const roleModels = resolveActiveRoleModels(runtimeHost.settings);
  const heavyModelId =
    dto.modelId ??
    roleModels.research ??
    runtimeHost.settings?.policy?.budget?.fallbackModelId ??
    (typeof DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary === 'string'
      ? DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.schemaSpecNode.primary
      : 'quality');
  const fastModelId =
    dto.modelId ??
    roleModels.manager ??
    (typeof DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary === 'string'
      ? DATA_REPORT_JSON_DEFAULT_MODEL_POLICY.analysisNode.primary
      : 'fast');
  const reportId = dto.reportSchemaInput?.meta.reportId?.trim();

  if (reportId) {
    return `report-schema:${cacheVersion}:${latencyStrategy}:${fastModelId}:${heavyModelId}:${reportId}`;
  }

  const goal = extractDirectGoal(dto);
  return goal ? `report-schema:${cacheVersion}:${latencyStrategy}:${fastModelId}:${heavyModelId}:${goal}` : undefined;
}
