import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { dataReportJsonPatchSchema } from '../schemas/report-page-schema';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPatchPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { generateReportJsonPartWithLlm } from './llm-part-helper';
import {
  applySchemaModificationWithCache,
  buildNodeScopedPatchOperations,
  buildVersionInfo,
  buildBrandNewPageSchema,
  buildPatchedPageSchema,
  emitJsonNodeStage,
  resolveNodeScopedPatchTarget,
  type DataReportJsonNodePatch
} from './shared';
import { classifyDataReportJsonPatchMode } from '../model-policy';

export async function runJsonPatchSchemaNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.patchSchemaNode) {
    return handlers.patchSchemaNode(state);
  }

  if (!state.currentSchema) {
    if (!state.filterSchema || !state.dataSources || !state.sections) {
      throw new Error('data-report-json patchSchemaNode requires generated parts before brand-new merge.');
    }

    const schema = buildBrandNewPageSchema({
      meta: state.meta!,
      pageDefaults: state.pageDefaults!,
      filterSchema: state.filterSchema,
      dataSources: state.dataSources,
      sections: state.sections,
      patchOperations: state.patchOperations ?? [],
      warnings: state.warnings
    });
    const versionInfo = buildVersionInfo(undefined, schema.patchOperations ?? []);

    emitJsonNodeStage(state, {
      node: 'patchSchemaNode',
      status: 'success',
      details: {
        modified: false,
        sectionCount: schema.sections.length,
        source: 'local',
        mode: 'brand-new-merge'
      }
    });
    return { schema, versionInfo };
  }

  const cachedPatch = applySchemaModificationWithCache(
    state.currentSchema,
    state.modificationRequest,
    state.disableCache,
    state.patchIntents
  );
  let schema = cachedPatch.schema;
  let modelId: string | undefined;
  const patchMode = classifyDataReportJsonPatchMode(state);
  const nodeScopedPatchTarget = resolveNodeScopedPatchTarget(state.modificationRequest);

  if (patchMode === 'complex' && nodeScopedPatchTarget && state.filterSchema && state.dataSources && state.sections) {
    schema = buildPatchedPageSchema({
      currentSchema: state.currentSchema,
      filterSchema: state.filterSchema,
      dataSources: state.dataSources,
      sections: state.sections,
      patchOperations: buildNodeScopedPatchOperations({
        currentSchema: state.currentSchema,
        request: state.modificationRequest,
        target: nodeScopedPatchTarget
      }),
      warnings: state.warnings ?? state.currentSchema.warnings
    });
  } else if (
    patchMode === 'complex' &&
    state.llm?.isConfigured() &&
    state.filterSchema &&
    state.dataSources &&
    state.sections
  ) {
    const patchResult = await generateReportJsonPartWithLlm({
      state,
      node: 'patchSchemaNode',
      schema: dataReportJsonPatchSchema,
      contractName: 'data-report-json-schema-patch',
      messages: [
        {
          role: 'system',
          content: createDataReportJsonPartSystemPrompt({
            partName: 'schemaPatch',
            outputRules: [
              '当前是修改已有 schema，只生成 meta、pageDefaults、patchOperations、warnings 四个字段组成的 JSON 对象。',
              'meta 里仅在 CHANGE_REQUEST 明确要求时修改 title、description、route、reportId 等字段，否则保持稳定。',
              'pageDefaults 需要与修改后的 filterSchema、sections 保持一致。',
              'patchOperations 只记录真正发生的修改，summary 用中文描述。'
            ]
          })
        },
        {
          role: 'user',
          content: createDataReportJsonPatchPartUserPrompt({
            changeRequest: state.modificationRequest,
            analysis: state.analysis,
            currentFragment: {
              meta: state.currentSchema.meta,
              pageDefaults: state.currentSchema.pageDefaults,
              patchOperations: state.currentSchema.patchOperations ?? [],
              warnings: state.currentSchema.warnings
            },
            currentSchema: buildPatchedPageSchema({
              currentSchema: state.currentSchema,
              filterSchema: state.filterSchema,
              dataSources: state.dataSources,
              sections: state.sections
            })
          })
        }
      ],
      partName: 'schemaPatch'
    });

    schema = buildPatchedPageSchema({
      currentSchema: state.currentSchema,
      filterSchema: state.filterSchema,
      dataSources: state.dataSources,
      sections: state.sections,
      ...patchResult.object
    });
    modelId = patchResult.modelId;
  }
  const versionInfo = buildVersionInfo(state.currentSchema, schema.patchOperations ?? []);

  emitJsonNodeStage(state, {
    node: 'patchSchemaNode',
    status: 'success',
    modelId,
    details: {
      modified: true,
      sectionCount: schema.sections.length,
      source: modelId ? 'llm' : 'local',
      modelId,
      patchMode,
      cacheHit: !modelId && cachedPatch.cacheHit
    }
  });

  return { schema, versionInfo };
}
