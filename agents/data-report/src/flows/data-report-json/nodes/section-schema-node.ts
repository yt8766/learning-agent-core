import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { dataReportJsonSectionsSpecSchema } from '../schemas/report-page-schema';
import {
  createDataReportJsonPartUserPrompt,
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPatchPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import {
  buildStructuredSchemaArtifacts,
  emitJsonNodeStage,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import { classifyDataReportJsonPatchMode } from '../model-policy';

export async function runJsonSectionSchemaNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.sectionSchemaNode) {
    return handlers.sectionSchemaNode(state);
  }

  let sections = state.currentSchema?.sections;
  let modelId: string | undefined;
  const patchMode = classifyDataReportJsonPatchMode(state);

  if (hasStructuredReportInput(state) && !state.currentSchema) {
    sections = buildStructuredSchemaArtifacts(state.reportSchemaInput).sections;
    modelId = undefined;
  } else if (state.currentSchema && patchMode === 'simple') {
    modelId = undefined;
  } else if (state.llm?.isConfigured()) {
    const isPatchMode = Boolean(state.currentSchema);
    const result = await generateReportJsonPartWithLlm({
      state,
      node: 'sectionSchemaNode',
      schema: dataReportJsonSectionsSpecSchema,
      contractName: 'data-report-json-section-patch',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'sections',
            outputRules: [
              isPatchMode
                ? '当前是修改已有 schema，只生成修改后的 sections 数组。'
                : '当前是新建 schema，只生成 brand-new sections 数组。',
              '优先保留或生成稳定的 section、block 顺序、dataSourceKey 与字段映射。',
              '如果请求涉及新增指标卡、图表或表格列，必须直接落到对应 section.blocks 中。'
            ]
          })
        },
        {
          role: 'user',
          content: isPatchMode
            ? createDataReportJsonPatchPartUserPrompt({
                changeRequest: state.modificationRequest,
                analysis: state.analysis,
                currentFragment: state.currentSchema?.sections,
                currentSchema: state.currentSchema,
                partName: 'sections'
              })
            : createDataReportJsonPartUserPrompt({
                context: state.nodeContexts?.sectionSchemaNode ?? state.goal,
                analysis: state.analysis,
                partName: 'sections',
                rawGoal: state.goal
              })
        }
      ],
      partName: 'sections'
    });
    sections = result.object;
    modelId = result.modelId;
  }

  if (!sections) {
    throw new Error('data-report-json sectionSchemaNode requires llm-generated sections.');
  }

  emitJsonNodeStage(state, {
    node: 'sectionSchemaNode',
    status: 'success',
    modelId,
    details: { sectionCount: sections.length, source: modelId ? 'llm' : 'local', modelId }
  });
  return { sections };
}
