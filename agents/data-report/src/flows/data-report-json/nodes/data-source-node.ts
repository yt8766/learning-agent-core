import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { dataReportJsonDataSourcesSpecSchema } from '../schemas/report-page-schema';
import {
  createDataReportJsonPartUserPrompt,
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPatchPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import {
  buildStructuredSchemaArtifacts,
  buildSingleReportDataSources,
  emitJsonNodeStage,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import { classifyDataReportJsonPatchMode } from '../model-policy';

export async function runJsonDataSourceNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.dataSourceNode) {
    return handlers.dataSourceNode(state);
  }

  let dataSources = state.currentSchema?.dataSources;
  let modelId: string | undefined;
  const patchMode = classifyDataReportJsonPatchMode(state);

  if (hasStructuredReportInput(state) && !state.currentSchema) {
    dataSources = buildStructuredSchemaArtifacts(state.reportSchemaInput).dataSources;
    modelId = undefined;
  } else if (state.currentSchema && patchMode === 'simple') {
    modelId = undefined;
  } else if (!state.currentSchema && !state.strictLlmBrandNew) {
    dataSources = buildSingleReportDataSources(state);
    modelId = undefined;
  } else if (state.llm?.isConfigured()) {
    const isPatchMode = Boolean(state.currentSchema);
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'dataSourceNode',
      schema: dataReportJsonDataSourcesSpecSchema,
      contractName: 'data-report-json-data-source-patch',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'dataSources',
            outputRules: [
              isPatchMode
                ? '当前是修改已有 schema，只生成修改后的 dataSources 对象。'
                : '当前是新建 schema，只生成 brand-new dataSources 对象。',
              '优先保留或生成稳定的 serviceKey、requestAdapter、responseAdapter。',
              '如果请求涉及接口名、参数映射或响应路径调整，必须直接更新对应 dataSource。'
            ]
          })
        },
        {
          role: 'user',
          content: isPatchMode
            ? createDataReportJsonPatchPartUserPrompt({
                changeRequest: state.modificationRequest,
                analysis: state.analysis,
                currentFragment: state.currentSchema?.dataSources,
                currentSchema: state.currentSchema,
                partName: 'dataSources'
              })
            : createDataReportJsonPartUserPrompt({
                context: state.nodeContexts?.dataSourceNode ?? state.goal,
                analysis: state.analysis,
                partName: 'dataSources',
                rawGoal: state.goal
              })
        }
      ],
      partName: 'dataSources'
    });
    dataSources = result.object;
    modelId = result.modelId;
  }

  if (!dataSources) {
    throw new Error('data-report-json dataSourceNode requires llm-generated data sources.');
  }

  emitJsonNodeStage(state, {
    node: 'dataSourceNode',
    status: 'success',
    modelId,
    details: { sourceCount: Object.keys(dataSources).length, source: modelId ? 'llm' : 'local', modelId }
  });
  return { dataSources };
}
