import type {
  DataReportJsonGenerateResult,
  DataReportJsonGenerationNode,
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState,
  DataReportJsonReportSummary
} from '../../types/data-report-json';
import {
  runJsonDataSourceNode,
  runJsonFilterSchemaNode,
  runJsonPatchSchemaNode,
  runJsonSectionSchemaNode,
  runJsonValidateNode
} from './nodes';
import { buildPartialPageSchema, buildReportSummaries } from './nodes/shared';
import { createGenerationError, mergeState, runNode } from './runtime-helpers';

export async function runBundleLane(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers,
  startedAt: number
): Promise<DataReportJsonGenerateResult> {
  const failedNodes: DataReportJsonGenerationNode[] = [];
  const reportSummaries: DataReportJsonReportSummary[] = [];
  const fragmentResults = await Promise.allSettled([
    runNode(state, 'filterSchemaNode', runJsonFilterSchemaNode, handlers),
    runNode(state, 'dataSourceNode', runJsonDataSourceNode, handlers),
    runNode(state, 'sectionSchemaNode', runJsonSectionSchemaNode, handlers)
  ]);
  const bundleNodes: DataReportJsonGenerationNode[] = ['filterSchemaNode', 'dataSourceNode', 'sectionSchemaNode'];

  fragmentResults.forEach((result, index) => {
    const node = bundleNodes[index]!;
    if (result.status === 'fulfilled') {
      state = mergeState(state, result.value);
      if (node === 'sectionSchemaNode') {
        reportSummaries.push(...buildReportSummaries(result.value.sections, { modelId: undefined }));
        if (Array.isArray(result.value.reportSummaries)) {
          reportSummaries.splice(0, reportSummaries.length, ...result.value.reportSummaries);
        }
      }
      return;
    }
    failedNodes.push(node);
  });

  const partialSchema = buildPartialPageSchema(state);
  const hasFragments =
    (Array.isArray(partialSchema.sections) && partialSchema.sections.length > 0) ||
    Boolean(partialSchema.filterSchema) ||
    Boolean(partialSchema.dataSources && Object.keys(partialSchema.dataSources).length);

  if (!hasFragments) {
    const error = createGenerationError({
      error: fragmentResults.find(result => result.status === 'rejected')?.reason,
      failedNode: failedNodes[0],
      failedNodes,
      failedReports: reportSummaries.filter(item => item.status === 'failed').map(item => item.reportKey),
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error }, null, 2),
      error,
      reportSummaries,
      elapsedMs: Date.now() - startedAt
    };
  }

  if (failedNodes.length > 0) {
    const error = createGenerationError({
      error: fragmentResults.find(result => result.status === 'rejected')?.reason,
      failedNode: failedNodes[0],
      failedNodes,
      failedReports: reportSummaries.filter(item => item.status === 'failed').map(item => item.reportKey),
      elapsedMs: Date.now() - startedAt
    });
    const nextReportSummaries =
      reportSummaries.length > 0
        ? reportSummaries
        : [
            {
              reportKey: state.meta?.reportId ?? state.analysis?.routeName ?? 'bundle-root',
              status: 'partial' as const,
              elapsedMs: Date.now() - startedAt
            }
          ];
    return {
      status: 'partial',
      partialSchema,
      error,
      reportSummaries: nextReportSummaries,
      content: JSON.stringify(
        { status: 'partial', schema: partialSchema, error, reportSummaries: nextReportSummaries },
        null,
        2
      ),
      elapsedMs: Date.now() - startedAt
    };
  }

  state = mergeState(state, await runNode(state, 'patchSchemaNode', runJsonPatchSchemaNode, handlers));
  state = mergeState(state, await runNode(state, 'validateNode', runJsonValidateNode, handlers));
  if (!state.schema) {
    const error = createGenerationError({
      error: new Error('bundle lane completed without schema'),
      failedNode: 'validateNode',
      failedNodes: ['validateNode'],
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error }, null, 2),
      error,
      reportSummaries,
      elapsedMs: Date.now() - startedAt
    };
  }

  return {
    status: 'success',
    schema: state.schema,
    reportSummaries:
      reportSummaries.length > 0
        ? reportSummaries
        : buildReportSummaries(state.schema.sections, { elapsedMs: Date.now() - startedAt }),
    content: JSON.stringify(state.schema, null, 2),
    elapsedMs: Date.now() - startedAt
  };
}

export async function runStandardLane(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers,
  startedAt: number
): Promise<DataReportJsonGenerateResult> {
  const failedNodes: DataReportJsonGenerationNode[] = [];
  const fragmentResults = await Promise.allSettled([
    runNode(state, 'filterSchemaNode', runJsonFilterSchemaNode, handlers),
    runNode(state, 'dataSourceNode', runJsonDataSourceNode, handlers),
    runNode(state, 'sectionSchemaNode', runJsonSectionSchemaNode, handlers)
  ]);
  const nodes: DataReportJsonGenerationNode[] = ['filterSchemaNode', 'dataSourceNode', 'sectionSchemaNode'];
  fragmentResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      state = mergeState(state, result.value);
      return;
    }
    failedNodes.push(nodes[index]!);
  });

  if (failedNodes.length > 0) {
    const partialSchema = buildPartialPageSchema(state);
    const hasFragments =
      Boolean(partialSchema.filterSchema) ||
      Boolean(partialSchema.dataSources && Object.keys(partialSchema.dataSources).length) ||
      (Array.isArray(partialSchema.sections) && partialSchema.sections.length > 0);
    const generationError = createGenerationError({
      error: fragmentResults.find(result => result.status === 'rejected')?.reason,
      failedNode: failedNodes[0],
      failedNodes,
      elapsedMs: Date.now() - startedAt
    });
    if (hasFragments) {
      return {
        status: 'partial',
        partialSchema,
        error: generationError,
        reportSummaries: buildReportSummaries(state.sections, { elapsedMs: Date.now() - startedAt }),
        content: JSON.stringify({ status: 'partial', schema: partialSchema, error: generationError }, null, 2),
        elapsedMs: Date.now() - startedAt
      };
    }
    return {
      status: 'failed',
      content: JSON.stringify({ status: 'failed', error: generationError }, null, 2),
      error: generationError,
      elapsedMs: Date.now() - startedAt
    };
  }

  try {
    state = mergeState(state, await runNode(state, 'patchSchemaNode', runJsonPatchSchemaNode, handlers));
    state = mergeState(state, await runNode(state, 'validateNode', runJsonValidateNode, handlers));
  } catch (error) {
    const partialSchema = buildPartialPageSchema(state);
    const generationError = createGenerationError({
      error,
      failedNode: 'patchSchemaNode',
      failedNodes: ['patchSchemaNode'],
      elapsedMs: Date.now() - startedAt
    });
    return {
      status: 'partial',
      partialSchema,
      error: generationError,
      reportSummaries: buildReportSummaries(state.sections, { elapsedMs: Date.now() - startedAt }),
      content: JSON.stringify({ status: 'partial', schema: partialSchema, error: generationError }, null, 2),
      elapsedMs: Date.now() - startedAt
    };
  }

  if (!state.schema) {
    const error = createGenerationError({
      error: new Error('data-report-json graph finished without schema.'),
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
