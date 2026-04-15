import type {
  DataReportJsonGenerateResult,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState
} from '../../types/data-report-json';
import { runJsonPatchSchemaNode, runJsonValidateNode } from './nodes';
import {
  applySchemaModificationWithCache,
  buildReportSummaries,
  emitJsonNodeStage,
  resolveNodeScopedPatchTarget,
  resolveNodeScopedPatchTargetFromIntents
} from './nodes/shared';
import { createGenerationError, mergeState, runNode } from './runtime-helpers';
import { runStandardLane } from './runtime-standard-lanes';

export async function runNodeScopedPatchLane(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers,
  startedAt: number
): Promise<DataReportJsonGenerateResult> {
  const target =
    resolveNodeScopedPatchTargetFromIntents(state.patchIntents) ??
    resolveNodeScopedPatchTarget(state.modificationRequest);
  if (!state.currentSchema || !target || target === 'dataSources') {
    return runStandardLane(state, handlers, startedAt);
  }

  const targetNode =
    target === 'filterSchema'
      ? 'filterSchemaNode'
      : target === 'metricsBlock'
        ? 'metricsBlockNode'
        : target === 'chartBlock'
          ? 'chartBlockNode'
          : 'tableBlockNode';

  const targetedRunner = async () => {
    const updated = applySchemaModificationWithCache(
      state.currentSchema!,
      state.modificationRequest,
      state.disableCache,
      state.patchIntents
    ).schema;

    if (target === 'filterSchema') {
      const patch = {
        filterSchema: updated.filterSchema,
        pageDefaults: updated.pageDefaults,
        sections: updated.sections
      };
      emitJsonNodeStage(state, {
        node: 'filterSchemaNode',
        status: 'success',
        details: {
          source: 'local',
          patchTarget: target
        }
      });
      return patch;
    }

    const patch = { sections: updated.sections };
    emitJsonNodeStage(state, {
      node: targetNode,
      status: 'success',
      details: {
        source: 'local',
        patchTarget: target
      }
    });
    return patch;
  };

  state = mergeState(state, {
    filterSchema: state.currentSchema.filterSchema,
    dataSources: state.currentSchema.dataSources,
    sections: state.currentSchema.sections,
    pageDefaults: state.currentSchema.pageDefaults
  });
  state = mergeState(state, await runNode(state, targetNode, async () => targetedRunner(), handlers));
  state = mergeState(state, await runNode(state, 'patchSchemaNode', runJsonPatchSchemaNode, handlers));
  state = mergeState(state, await runNode(state, 'validateNode', runJsonValidateNode, handlers));

  if (!state.schema) {
    const error = createGenerationError({
      error: new Error('node-scoped patch lane completed without schema'),
      failedNode: 'validateNode',
      failedNodes: ['validateNode'],
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error }, null, 2),
      error,
      elapsedMs: Date.now() - startedAt
    };
  }

  return {
    status: 'success',
    schema: state.schema,
    reportSummaries: buildReportSummaries(state.schema.sections, { elapsedMs: Date.now() - startedAt }),
    content: JSON.stringify(state.schema, null, 2),
    elapsedMs: Date.now() - startedAt
  };
}
