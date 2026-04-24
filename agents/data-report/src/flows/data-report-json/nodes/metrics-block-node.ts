import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { dataReportJsonMetricsBlockSchema } from '../schemas/report-page-schema';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportMetricsBlock,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'metricsBlockNode');
}

export async function runJsonMetricsBlockNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.metricsBlockNode) {
    return handlers.metricsBlockNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = state.strictLlmBrandNew
    ? undefined
    : getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionMetricsBlock']>>(
        cacheKey,
        state.disableCache
      );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'metricsBlockNode',
      status: 'success',
      cacheHit: true,
      details: { source: 'local', cacheHit: true }
    });
    return {
      sectionMetricsBlock: cached,
      splitBlockCacheHit: true
    };
  }

  let sectionMetricsBlock = buildSingleReportMetricsBlock(state);
  let modelId: string | undefined;
  let attemptedLlm = false;
  const degraded = false;
  const fallbackReason: string | undefined = undefined;

  if (state.strictLlmBrandNew) {
    attemptedLlm = true;
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'metricsBlockNode',
      schema: dataReportJsonMetricsBlockSchema,
      contractName: 'data-report-json-metrics-block',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'metricsBlock',
            outputRules: [
              '只生成 metrics block。',
              'items 必须来自用户需求中的核心指标或字段含义。',
              '字段名必须能与表格/图表/dataSource 返回字段稳定对应。'
            ]
          })
        },
        {
          role: 'user',
          content: createDataReportJsonPartUserPrompt({
            context: state.nodeContexts?.metricsBlockNode ?? state.goal,
            analysis: state.analysis,
            partName: 'metricsBlock',
            rawGoal: state.goal
          })
        }
      ],
      partName: 'metricsBlock'
    });
    sectionMetricsBlock = result.object;
    modelId = result.modelId;
  }

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionMetricsBlock, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'metricsBlockNode',
    status: 'success',
    cacheHit: false,
    modelId,
    details: {
      source: modelId ? 'llm' : 'local',
      cacheHit: false,
      modelId,
      attemptedLlm,
      degraded,
      fallbackReason
    }
  });
  return {
    sectionMetricsBlock,
    warnings: state.warnings
  };
}
