import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { resolveFirstModelSelectorCandidate } from '../../../utils/model-selection';
import {
  emitJsonNodeStage,
  buildDeterministicSchemaSpec,
  buildStructuredSchemaArtifacts,
  hasStructuredReportInput,
  type DataReportJsonNodePatch
} from './shared';

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
