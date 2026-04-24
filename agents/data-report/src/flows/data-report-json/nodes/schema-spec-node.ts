import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { resolveFirstModelSelectorCandidate } from '../../../utils/model-selection';
import {
  createDataReportJsonPartSystemPrompt,
  createDataReportJsonPartUserPrompt
} from '../prompts/generate-report-page-part-prompt';
import { dataReportJsonMetaSpecSchema, dataReportJsonPageDefaultsSchema } from '../schemas/report-page-schema';
import {
  emitJsonNodeStage,
  buildDeterministicSchemaSpec,
  buildStructuredSchemaArtifacts,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';
import { generateReportJsonPartWithLlm } from './llm-part-helper';

export async function runJsonSchemaSpecNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.schemaSpecNode) {
    return handlers.schemaSpecNode(state);
  }

  if (state.currentSchema) {
    emitJsonNodeStage(state, {
      node: 'schemaSpecNode',
      status: 'success',
      details: { skipped: true, mode: 'patch' }
    });
    return {};
  }

  if (hasStructuredReportInput(state)) {
    const structured = buildStructuredSchemaArtifacts(state.reportSchemaInput);
    emitJsonNodeStage(state, {
      node: 'schemaSpecNode',
      status: 'success',
      details: {
        scope: structured.meta.scope,
        layout: structured.meta.layout,
        source: 'structured-input',
        cacheHit: false
      }
    });
    return {
      meta: structured.meta,
      pageDefaults: structured.pageDefaults,
      patchOperations: [],
      warnings: structured.warnings,
      cacheHit: false
    };
  }

  if (state.strictLlmBrandNew) {
    const [metaResult, pageDefaultsResult] = await Promise.all([
      generateReportJsonPartWithLlm({
        state,
        node: 'schemaSpecNode',
        schema: dataReportJsonMetaSpecSchema,
        contractName: 'data-report-json-meta-spec',
        messages: [
          {
            role: 'system',
            content: createDataReportJsonPartSystemPrompt({
              partName: 'meta',
              outputRules: [
                '只生成 meta 对象，不要生成 owner 字段。',
                'reportId、route、templateRef 必须从用户需求中推断，命名稳定可复用。',
                'scope 必须按用户要求判断单报表或多报表。'
              ]
            })
          },
          {
            role: 'user',
            content: createDataReportJsonPartUserPrompt({
              context: state.nodeContexts?.schemaSpecNode ?? state.goal,
              analysis: state.analysis,
              partName: 'meta',
              rawGoal: state.goal
            })
          }
        ],
        partName: 'meta'
      }),
      generateReportJsonPartWithLlm({
        state,
        node: 'schemaSpecNode',
        schema: dataReportJsonPageDefaultsSchema,
        contractName: 'data-report-json-page-defaults',
        messages: [
          {
            role: 'system',
            content: createDataReportJsonPartSystemPrompt({
              partName: 'pageDefaults',
              outputRules: [
                '只生成 pageDefaults 对象。',
                'filters 必须覆盖用户明确提到的默认筛选条件。',
                'queryPolicy.cacheKey 必须与报表主题稳定对应。'
              ]
            })
          },
          {
            role: 'user',
            content: createDataReportJsonPartUserPrompt({
              context: state.nodeContexts?.schemaSpecNode ?? state.goal,
              analysis: state.analysis,
              partName: 'pageDefaults',
              rawGoal: state.goal
            })
          }
        ],
        partName: 'pageDefaults'
      })
    ]);

    emitJsonNodeStage(state, {
      node: 'schemaSpecNode',
      status: 'success',
      modelId: metaResult.modelId,
      details: {
        scope: metaResult.object.scope,
        layout: metaResult.object.layout,
        source: 'llm',
        modelId: metaResult.modelId,
        pageDefaultsModelId: pageDefaultsResult.modelId
      }
    });

    return {
      meta: metaResult.object,
      pageDefaults: pageDefaultsResult.object,
      patchOperations: [],
      warnings: [],
      cacheHit: false
    };
  }

  const scaffold = buildDeterministicSchemaSpec(state);

  emitJsonNodeStage(state, {
    node: 'schemaSpecNode',
    status: 'success',
    modelId: resolveFirstModelSelectorCandidate({
      llm: state.llm,
      selector: state.nodeModelPolicy?.schemaSpecNode.primary
    }),
    cacheHit: scaffold.cacheHit,
    details: {
      scope: scaffold.meta.scope,
      layout: scaffold.meta.layout,
      source: 'local',
      cacheHit: scaffold.cacheHit
    }
  });

  return {
    meta: scaffold.meta,
    pageDefaults: scaffold.pageDefaults,
    patchOperations: scaffold.patchOperations,
    warnings: scaffold.warnings,
    cacheHit: scaffold.cacheHit
  };
}
