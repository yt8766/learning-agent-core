import type {
  DataReportJsonGenerateResult,
  DataReportJsonGenerationNode,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState
} from '../../types/data-report-json';
import {
  runJsonChartBlockNode,
  runJsonDataSourceNode,
  runJsonFilterSchemaNode,
  runJsonMetricsBlockNode,
  runJsonPatchSchemaNode,
  runJsonSectionAssembleNode,
  runJsonSectionPlanNode,
  runJsonTableBlockNode,
  runJsonValidateNode
} from './nodes';
import { buildPartialPageSchema, buildReportSummaries } from './nodes/shared';
import {
  SPLIT_BLOCK_TIMEOUT_MS,
  createGenerationError,
  emitArtifact,
  mergeState,
  resolveStrictFragmentTimeoutMs,
  runNode,
  runNodeWithRetry,
  runNodeWithTimeoutFallback
} from './runtime-helpers';

export async function runSplitSingleReportLane(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers,
  startedAt: number
): Promise<DataReportJsonGenerateResult> {
  const strictFragmentTimeoutMs = resolveStrictFragmentTimeoutMs(state);
  const preSectionResults = await Promise.all([
    runNodeWithTimeoutFallback(state, 'filterSchemaNode', runJsonFilterSchemaNode, handlers, strictFragmentTimeoutMs),
    runNodeWithTimeoutFallback(state, 'dataSourceNode', runJsonDataSourceNode, handlers, strictFragmentTimeoutMs)
  ]);
  state = mergeState(state, preSectionResults[0]);
  state = mergeState(state, preSectionResults[1]);
  state = mergeState(state, await runNode(state, 'sectionPlanNode', runJsonSectionPlanNode, handlers));
  emitArtifact(state, { phase: 'skeleton' });

  const blockNodes: DataReportJsonGenerationNode[] = ['metricsBlockNode', 'chartBlockNode', 'tableBlockNode'];
  const failedNodes: DataReportJsonGenerationNode[] = [];
  const blockResults = await Promise.all(
    blockNodes.map((node, index) =>
      runNodeWithRetry(
        state,
        node as 'metricsBlockNode' | 'chartBlockNode' | 'tableBlockNode',
        index === 0 ? runJsonMetricsBlockNode : index === 1 ? runJsonChartBlockNode : runJsonTableBlockNode,
        handlers,
        state.strictLlmBrandNew ? undefined : SPLIT_BLOCK_TIMEOUT_MS
      )
        .then(value => {
          state = mergeState(state, value);
          emitArtifact(state, {
            phase: 'block',
            blockType: node === 'metricsBlockNode' ? 'metrics' : node === 'chartBlockNode' ? 'chart' : 'table'
          });
          return { status: 'fulfilled' as const, value };
        })
        .catch(reason => {
          failedNodes.push(node);
          state = mergeState(state, {
            warnings: [
              ...(state.warnings ?? []),
              `${node} 降级：${reason instanceof Error ? reason.message : String(reason)}`
            ]
          });
          return { status: 'rejected' as const, reason };
        })
    )
  );

  if (!state.sectionMetricsBlock && !state.sectionChartBlock && !state.sectionTableBlock) {
    const error = createGenerationError({
      error: blockResults.find(result => result.status === 'rejected')?.reason,
      failedNode: failedNodes[0],
      failedNodes,
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error }, null, 2),
      error,
      elapsedMs: Date.now() - startedAt
    };
  }

  state = mergeState(state, await runNode(state, 'sectionAssembleNode', runJsonSectionAssembleNode, handlers));
  const partialSchema = buildPartialPageSchema(state);

  if (failedNodes.length > 0) {
    const error = createGenerationError({
      error: blockResults.find(result => result.status === 'rejected')?.reason,
      failedNode: failedNodes[0],
      failedNodes,
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'partial',
      partialSchema,
      error,
      reportSummaries: buildReportSummaries(state.sections, {
        elapsedMs: Date.now() - startedAt,
        cacheHit: state.splitBlockCacheHit
      }),
      content: JSON.stringify({ status: 'partial', schema: partialSchema, error }, null, 2),
      elapsedMs: Date.now() - startedAt
    };
  }

  state = mergeState(state, await runNode(state, 'patchSchemaNode', runJsonPatchSchemaNode, handlers));
  state = mergeState(state, await runNode(state, 'validateNode', runJsonValidateNode, handlers));
  if (!state.schema) {
    const error = createGenerationError({
      error: new Error('split single-report lane completed without schema'),
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
    reportSummaries: buildReportSummaries(state.schema.sections, {
      elapsedMs: Date.now() - startedAt,
      cacheHit: state.splitBlockCacheHit
    }),
    content: JSON.stringify(state.schema, null, 2),
    elapsedMs: Date.now() - startedAt
  };
}
