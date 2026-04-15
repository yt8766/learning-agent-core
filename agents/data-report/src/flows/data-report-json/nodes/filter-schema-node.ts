import type {
  DataReportJsonFilterSchema,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState
} from '../../../types/data-report-json';
import { dataReportJsonFilterSchema } from '../schemas/report-page-schema';
import {
  createDataReportJsonPartUserPrompt,
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPatchPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import {
  buildStructuredSchemaArtifacts,
  buildSingleReportFilterSchema,
  emitJsonNodeStage,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import { classifyDataReportJsonPatchMode } from '../model-policy';

export async function runJsonFilterSchemaNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.filterSchemaNode) {
    return handlers.filterSchemaNode(state);
  }

  let filterSchema: DataReportJsonFilterSchema | undefined = state.currentSchema?.filterSchema;
  let modelId: string | undefined;
  const patchMode = classifyDataReportJsonPatchMode(state);

  if (hasStructuredReportInput(state) && !state.currentSchema) {
    filterSchema = buildStructuredSchemaArtifacts(state.reportSchemaInput).filterSchema;
    modelId = undefined;
  } else if (state.currentSchema && patchMode === 'simple') {
    modelId = undefined;
  } else if (!state.currentSchema && !state.strictLlmBrandNew) {
    filterSchema = buildSingleReportFilterSchema(state);
    modelId = undefined;
  } else if (state.llm?.isConfigured()) {
    const isPatchMode = Boolean(state.currentSchema);
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'filterSchemaNode',
      schema: dataReportJsonFilterSchema,
      contractName: 'data-report-json-filter-patch',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'filterSchema',
            outputRules: [
              isPatchMode
                ? '当前是修改已有 schema，只生成修改后的 filterSchema 对象。'
                : '当前是新建 schema，只生成 brand-new filterSchema 对象。',
              '优先保留或生成稳定的字段名、requestMapping、componentKey 与默认值。',
              '如果请求涉及筛选项默认值、筛选字段增删或字段文案调整，必须直接体现在 filterSchema 中。'
            ]
          })
        },
        {
          role: 'user',
          content: isPatchMode
            ? createDataReportJsonPatchPartUserPrompt({
                changeRequest: state.modificationRequest,
                analysis: state.analysis,
                currentFragment: state.currentSchema?.filterSchema,
                currentSchema: state.currentSchema,
                partName: 'filterSchema'
              })
            : createDataReportJsonPartUserPrompt({
                context: state.nodeContexts?.filterSchemaNode ?? state.goal,
                analysis: state.analysis,
                partName: 'filterSchema',
                rawGoal: state.goal
              })
        }
      ],
      partName: 'filterSchema'
    });
    filterSchema = result.object as DataReportJsonFilterSchema;
    modelId = result.modelId;
  }

  if (!filterSchema) {
    throw new Error('data-report-json filterSchemaNode requires llm-generated filter schema.');
  }

  emitJsonNodeStage(state, {
    node: 'filterSchemaNode',
    status: 'success',
    modelId,
    details: { fieldCount: filterSchema.fields.length, source: modelId ? 'llm' : 'local', modelId }
  });
  return { filterSchema: filterSchema as DataReportJsonFilterSchema };
}
