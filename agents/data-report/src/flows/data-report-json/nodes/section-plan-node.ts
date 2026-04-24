import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { dataReportJsonSectionPlanSchema } from '../schemas/report-page-schema';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportSectionPlan,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'sectionPlanNode');
}

export async function runJsonSectionPlanNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.sectionPlanNode) {
    return handlers.sectionPlanNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionPlan']>>(
    cacheKey,
    state.disableCache
  );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'sectionPlanNode',
      status: 'success',
      cacheHit: true,
      details: {
        source: 'local',
        cacheHit: true
      }
    });
    return {
      sectionPlan: cached,
      splitBlockCacheHit: true
    };
  }

  let sectionPlan = buildSingleReportSectionPlan(state);
  let modelId: string | undefined;

  if (state.strictLlmBrandNew) {
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'sectionPlanNode',
      schema: dataReportJsonSectionPlanSchema,
      contractName: 'data-report-json-section-plan',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'sectionPlan',
            outputRules: [
              '只生成单个 section plan 对象，不要生成 blocks。',
              'dataSourceKey 必须引用 dataSources 中已经生成的 key。',
              'sectionDefaults 必须包含 filters、table 与 chart 默认配置。'
            ]
          })
        },
        {
          role: 'user',
          content: createDataReportJsonPartUserPrompt({
            context: state.nodeContexts?.sectionPlanNode ?? state.goal,
            analysis: state.analysis,
            partName: 'sectionPlan',
            rawGoal: state.goal
          })
        }
      ],
      partName: 'sectionPlan'
    });
    sectionPlan = result.object;
    modelId = result.modelId;
  }

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionPlan, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'sectionPlanNode',
    status: 'success',
    cacheHit: false,
    modelId,
    details: {
      source: modelId ? 'llm' : 'local',
      cacheHit: false,
      modelId
    }
  });
  return { sectionPlan };
}
