import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { dataReportJsonTableBlockSchema } from '../schemas/report-page-schema';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportTableBlock,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'tableBlockNode');
}

export async function runJsonTableBlockNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.tableBlockNode) {
    return handlers.tableBlockNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = state.strictLlmBrandNew
    ? undefined
    : getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionTableBlock']>>(
        cacheKey,
        state.disableCache
      );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'tableBlockNode',
      status: 'success',
      cacheHit: true,
      details: { source: 'local', cacheHit: true }
    });
    return {
      sectionTableBlock: cached,
      splitBlockCacheHit: true
    };
  }

  let sectionTableBlock = buildSingleReportTableBlock(state);
  let modelId: string | undefined;
  let attemptedLlm = false;
  const degraded = false;
  const fallbackReason: string | undefined = undefined;

  if (state.strictLlmBrandNew) {
    attemptedLlm = true;
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'tableBlockNode',
      schema: dataReportJsonTableBlockSchema,
      contractName: 'data-report-json-table-block',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'tableBlock',
            outputRules: [
              '只生成 table block。',
              'columns 必须覆盖用户需求中的字段列表和关键维度。',
              'dataIndex 必须保持接口字段名或清晰的前端展示字段名。'
            ]
          })
        },
        {
          role: 'user',
          content: createDataReportJsonPartUserPrompt({
            context: state.nodeContexts?.tableBlockNode ?? state.goal,
            analysis: state.analysis,
            partName: 'tableBlock',
            rawGoal: state.goal
          })
        }
      ],
      partName: 'tableBlock'
    });
    sectionTableBlock = result.object;
    modelId = result.modelId;
  }

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionTableBlock, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'tableBlockNode',
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
    sectionTableBlock,
    warnings: state.warnings
  };
}
