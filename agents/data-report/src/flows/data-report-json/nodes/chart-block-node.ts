import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { dataReportJsonChartBlockSchema } from '../schemas/report-page-schema';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportChartBlock,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';
import { shouldPreferDeterministicSingleReportBlocks } from '../model-policy';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'chartBlockNode');
}

function shouldEscalateChartBlockToLlm(state: DataReportJsonGraphState) {
  if (state.strictLlmBrandNew) {
    return true;
  }

  if (!state.llm?.isConfigured()) {
    return false;
  }

  if (shouldPreferDeterministicSingleReportBlocks(state) && !state.strictLlmBrandNew) {
    return false;
  }

  return /双轴|双Y轴|line-bar|混合图|组合图|stack|堆叠|top\s*n|topn|环比|同比|对比/i.test(state.goal);
}

export async function runJsonChartBlockNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.chartBlockNode) {
    return handlers.chartBlockNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = state.strictLlmBrandNew
    ? undefined
    : getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionChartBlock']>>(
        cacheKey,
        state.disableCache
      );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'chartBlockNode',
      status: 'success',
      cacheHit: true,
      details: { source: 'local', cacheHit: true }
    });
    return {
      sectionChartBlock: cached,
      splitBlockCacheHit: true
    };
  }

  let sectionChartBlock = buildSingleReportChartBlock(state);
  let modelId: string | undefined;
  let degraded = false;
  let fallbackReason: string | undefined;
  let attemptedLlm = false;
  if (shouldEscalateChartBlockToLlm(state)) {
    attemptedLlm = true;
    try {
      const result = await generateReportJsonPartWithLlm({
        state,
        node: 'chartBlockNode',
        schema: dataReportJsonChartBlockSchema,
        contractName: 'data-report-json-chart-block',
        messages: [
          {
            role: 'system',
            content: createDataReportJsonPartSystemPrompt({
              partName: 'chartBlock',
              outputRules: ['只生成 chart block。', '字段必须适配单报表 section.blocks。']
            })
          },
          {
            role: 'user',
            content: createDataReportJsonPartUserPrompt({
              context: state.nodeContexts?.chartBlockNode ?? state.goal,
              analysis: state.analysis,
              partName: 'chartBlock',
              rawGoal: state.goal
            })
          }
        ],
        partName: 'chartBlock'
      });
      sectionChartBlock = result.object;
      modelId = result.modelId;
    } catch (error) {
      if (state.strictLlmBrandNew) {
        throw error;
      }
      degraded = true;
      fallbackReason = error instanceof Error ? error.message : String(error);
    }
  }

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionChartBlock, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'chartBlockNode',
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
    sectionChartBlock,
    warnings:
      degraded && fallbackReason
        ? [...(state.warnings ?? []), `chartBlockNode 降级：${fallbackReason}`]
        : state.warnings
  };
}
